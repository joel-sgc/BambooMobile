use base64::{engine::general_purpose::STANDARD, Engine as _};
use rumqttc::{AsyncClient, ConnectReturnCode, Event, MqttOptions, Packet, QoS, TlsConfiguration, Transport};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{DigitallySignedStruct, SignatureScheme};
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State as TauriState};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    sync::Mutex,
    task::AbortHandle,
};

// ── TLS: accept any certificate (Bambu printers use self-signed) ─────────────

#[derive(Debug)]
struct SkipVerifier;

impl ServerCertVerifier for SkipVerifier {
    fn verify_server_cert(
        &self, _: &CertificateDer, _: &[CertificateDer], _: &ServerName, _: &[u8], _: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }
    fn verify_tls12_signature(
        &self, _: &[u8], _: &CertificateDer, _: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }
    fn verify_tls13_signature(
        &self, _: &[u8], _: &CertificateDer, _: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }
    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PKCS1_SHA256,
            SignatureScheme::RSA_PKCS1_SHA384,
            SignatureScheme::RSA_PKCS1_SHA512,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::ECDSA_NISTP384_SHA384,
            SignatureScheme::ECDSA_NISTP521_SHA512,
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::RSA_PSS_SHA384,
            SignatureScheme::RSA_PSS_SHA512,
            SignatureScheme::ED25519,
        ]
    }
}

// ── Printer status types (mirrored in vite-env.d.ts) ─────────────────────────

#[derive(Debug, Clone, Serialize, Default)]
pub struct PrinterStatus {
    pub nozzle_temp: f64,
    pub nozzle_target: f64,
    pub bed_temp: f64,
    pub bed_target: f64,
    pub progress: u8,
    pub remaining_mins: u32,
    pub layer_num: u32,
    pub total_layer_num: u32,
    pub stage: String,
    pub gcode_state: String,
    pub ams: Vec<AmsUnit>,
    pub vt_tray: Option<AmsTray>,
    pub chamber_light: bool,
    pub spd_lvl: u8,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct AmsUnit {
    pub id: u8,
    pub humidity: u8,
    pub trays: Vec<AmsTray>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct AmsTray {
    pub id: u8,
    pub tray_type: String,
    pub color: String,
    pub name: String,
}

// ── App state ─────────────────────────────────────────────────────────────────

pub(crate) struct AppState {
    pub(crate) connection: Mutex<Option<ConnectionHandles>>,
}

struct ConnectionHandles {
    serial: String,
    mqtt_client: AsyncClient,
    abort_handles: Vec<AbortHandle>,
    status: Arc<Mutex<PrinterStatus>>,
}

// ── MQTT payload parsing ──────────────────────────────────────────────────────

fn parse_status(payload: &[u8], status: &mut PrinterStatus) {
    let Ok(v) = serde_json::from_slice::<serde_json::Value>(payload) else { return };
    let Some(p) = v.get("print") else { return };

    macro_rules! f64_field {
        ($dst:expr, $key:expr) => {
            if let Some(n) = p.get($key).and_then(|v| v.as_f64()) { $dst = n; }
        };
    }
    macro_rules! u64_field {
        ($dst:expr, $key:expr) => {
            if let Some(n) = p.get($key).and_then(|v| v.as_u64()) { $dst = n as _; }
        };
    }
    macro_rules! str_field {
        ($dst:expr, $key:expr) => {
            if let Some(s) = p.get($key).and_then(|v| v.as_str()) { $dst = s.to_owned(); }
        };
    }

    f64_field!(status.nozzle_temp,    "nozzle_temper");
    f64_field!(status.nozzle_target,  "nozzle_target_temper");
    f64_field!(status.bed_temp,       "bed_temper");
    f64_field!(status.bed_target,     "bed_target_temper");
    u64_field!(status.progress,       "mc_percent");
    u64_field!(status.remaining_mins, "mc_remaining_time");
    u64_field!(status.layer_num,      "layer_num");
    u64_field!(status.total_layer_num,"total_layer_num");
    u64_field!(status.spd_lvl,        "spd_lvl");
    str_field!(status.gcode_state,    "gcode_state");

    if let Some(n) = p.get("stg_cur").and_then(|v| v.as_u64()) {
        status.stage = stage_name(n);
    }

    if let Some(lights) = p.get("lights_report").and_then(|v| v.as_array()) {
        for light in lights {
            if light.get("node").and_then(|v| v.as_str()) == Some("chamber_light") {
                status.chamber_light =
                    light.get("mode").and_then(|v| v.as_str()) == Some("on");
            }
        }
    }

    // Bambu firmware sends numeric IDs as JSON strings ("0", "1", …).
    // parse_u8 accepts both forms and is reused for AMS and vt_tray parsing.
    let parse_u8 = |v: &serde_json::Value| -> u8 {
        v.as_u64()
            .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
            .unwrap_or(0) as u8
    };

    if let Some(ams_arr) = p
        .get("ams")
        .and_then(|v| v.get("ams"))
        .and_then(|v| v.as_array())
    {

        status.ams = ams_arr
            .iter()
            .filter_map(|unit| {
                let id = parse_u8(unit.get("id")?);
                let humidity = unit
                    .get("humidity")
                    .map(parse_u8)
                    .unwrap_or(0);
                let trays = unit
                    .get("tray")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .map(|t| {
                                let id = parse_u8(t.get("id").unwrap_or(&serde_json::Value::Null));
                                let tray_type = t
                                    .get("tray_type")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_owned();
                                let raw = t
                                    .get("tray_color")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("3F3F4600");
                                // colour is RRGGBBAA; we only need RRGGBB
                                let color = raw[..raw.len().min(6)].to_owned();
                                let name = t
                                    .get("tray_sub_brands")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_owned();
                                AmsTray { id, tray_type, color, name }
                            })
                            .collect()
                    })
                    .unwrap_or_default();
                Some(AmsUnit { id, humidity, trays })
            })
            .collect();
    }

    // External spool (mounted outside AMS)
    if let Some(vt) = p.get("vt_tray") {
        let tray_type = vt.get("tray_type").and_then(|v| v.as_str()).unwrap_or("").to_owned();
        status.vt_tray = if !tray_type.is_empty() {
            let id = parse_u8(vt.get("id").unwrap_or(&serde_json::Value::Null));
            let raw = vt.get("tray_color").and_then(|v| v.as_str()).unwrap_or("3F3F4600");
            let color = raw[..raw.len().min(6)].to_owned();
            let name = vt.get("tray_sub_brands").and_then(|v| v.as_str()).unwrap_or("").to_owned();
            Some(AmsTray { id, tray_type, color, name })
        } else {
            None
        };
    }
}

fn stage_name(stg: u64) -> String {
    match stg {
        0  => "Idle",
        1  => "Auto bed leveling",
        2  => "Heatbed preheating",
        4  => "Changing filament",
        7  => "Heating hotend",
        9  => "Scanning bed surface",
        10 => "Inspecting first layer",
        13 => "Homing toolhead",
        14 => "Cleaning nozzle",
        17 => "Printing",
        20 => "Paused by user",
        22 => "Filament unloading",
        24 => "Filament loading",
        _  => "Working",
    }
    .to_owned()
}

// ── Camera: MJPG over TLS on port 6000 ───────────────────────────────────────
//
// Protocol (per OpenBambuAPI/video.md):
//   1. TLS connect to <ip>:6000 (self-signed cert, no verification)
//   2. Send 80-byte auth packet:
//        [0..3]   u32 LE = 0x40        (payload size)
//        [4..7]   u32 LE = 0x3000      (packet type: auth)
//        [8..15]  u64    = 0            (flags + padding)
//        [16..47] 32 bytes: "bblp" NUL-padded
//        [48..79] 32 bytes: access_code NUL-padded
//   3. Loop: read 16-byte frame header (payload_size u32 LE, ...) then JPEG.

async fn camera_loop(ip: String, access_code: String, app: AppHandle) {
    let tls_cfg = Arc::new(
        rustls::ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(SkipVerifier))
            .with_no_client_auth(),
    );
    let connector = tokio_rustls::TlsConnector::from(tls_cfg);

    // Derive a ServerName from the IP (no SNI for raw IPs, but verification
    // is disabled anyway so the printer's self-signed cert is accepted).
    let server_name: ServerName<'static> = match ip.parse::<std::net::IpAddr>() {
        Ok(addr) => ServerName::IpAddress(rustls::pki_types::IpAddr::from(addr)),
        Err(_) => match ServerName::try_from(ip.clone()) {
            Ok(n) => n,
            Err(_) => return,
        },
    };

    loop {
        let Ok(stream) = tokio::net::TcpStream::connect(format!("{}:6000", ip)).await else {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            continue;
        };

        let Ok(mut tls) = connector.connect(server_name.clone(), stream).await else {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            continue;
        };

        // Build and send 80-byte auth packet
        let mut auth = [0u8; 80];
        auth[0..4].copy_from_slice(&0x40u32.to_le_bytes());
        auth[4..8].copy_from_slice(&0x3000u32.to_le_bytes());
        let user = b"bblp";
        auth[16..16 + user.len()].copy_from_slice(user);
        let pass = access_code.as_bytes();
        let plen = pass.len().min(32);
        auth[48..48 + plen].copy_from_slice(&pass[..plen]);

        if tls.write_all(&auth).await.is_err() {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            continue;
        }

        // Read frames until error or disconnect
        loop {
            let mut hdr = [0u8; 16];
            if tls.read_exact(&mut hdr).await.is_err() {
                break;
            }

            let payload_size = u32::from_le_bytes(hdr[0..4].try_into().unwrap()) as usize;
            if payload_size == 0 || payload_size > 1_048_576 {
                break;
            }

            let mut frame = vec![0u8; payload_size];
            if tls.read_exact(&mut frame).await.is_err() {
                break;
            }

            // Validate JPEG start-of-image marker
            if payload_size >= 2 && frame[0] == 0xFF && frame[1] == 0xD8 {
                let b64 = STANDARD.encode(&frame);
                let _ = app.emit("camera-frame", b64);
            }
        }

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn connect_printer(
    ip: String,
    access_code: String,
    serial: String,
    app: AppHandle,
    state: TauriState<'_, AppState>,
) -> Result<(), String> {
    let mut conn = state.connection.lock().await;
    if conn.is_some() {
        return Err("Already connected".into());
    }

    // MQTT with TLS (skip cert verification for Bambu self-signed cert)
    let tls_cfg = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(SkipVerifier))
        .with_no_client_auth();

    let mut opts = MqttOptions::new("bambu-mobile", &ip, 8883);
    opts.set_credentials("bblp", &access_code);
    opts.set_keep_alive(std::time::Duration::from_secs(10));
    opts.set_transport(Transport::Tls(TlsConfiguration::Rustls(Arc::new(tls_cfg))));

    let (mqtt_client, mut eventloop) = AsyncClient::new(opts, 64);

    // Poll until CONNACK with 10s timeout
    tokio::time::timeout(std::time::Duration::from_secs(10), async {
        loop {
            match eventloop.poll().await {
                Ok(Event::Incoming(Packet::ConnAck(ack))) => {
                    return if ack.code == ConnectReturnCode::Success {
                        Ok(())
                    } else {
                        Err(format!("Authentication failed ({:?}) — check access code", ack.code))
                    };
                }
                Ok(_) => continue,
                Err(e) => return Err(format!("Cannot reach printer: {}", e)),
            }
        }
    })
    .await
    .unwrap_or_else(|_| Err("Timed out — check printer IP and network".to_string()))?;

    // Subscribe and request a full status dump
    let topic = format!("device/{}/report", serial);
    mqtt_client.subscribe(&topic, QoS::AtMostOnce).await.map_err(|e| e.to_string())?;

    let req_topic = format!("device/{}/request", serial);
    let _ = mqtt_client
        .publish(
            &req_topic,
            QoS::AtLeastOnce,
            false,
            serde_json::json!({"pushing": {"sequence_id": "0", "command": "pushall", "version": 1}}).to_string(),
        )
        .await;

    let status = Arc::new(Mutex::new(PrinterStatus::default()));
    let mut abort_handles: Vec<AbortHandle> = Vec::new();

    // MQTT event loop task
    let status_c = status.clone();
    let app_c = app.clone();
    let handle = tokio::spawn(async move {
        loop {
            match eventloop.poll().await {
                Ok(Event::Incoming(Packet::Publish(msg))) => {
                    let mut st = status_c.lock().await;
                    parse_status(&msg.payload, &mut st);
                    let _ = app_c.emit("printer-status", st.clone());
                }
                Err(_) => {
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                }
                _ => {}
            }
        }
    });
    abort_handles.push(handle.abort_handle());
    drop(handle);

    // Camera: MJPG over TLS on port 6000
    let camera_handle = tokio::spawn(camera_loop(ip, access_code, app));
    abort_handles.push(camera_handle.abort_handle());
    drop(camera_handle);

    *conn = Some(ConnectionHandles {
        serial,
        mqtt_client,
        abort_handles,
        status,
    });

    Ok(())
}

#[tauri::command]
async fn disconnect_printer(state: TauriState<'_, AppState>) -> Result<(), String> {
    let mut conn = state.connection.lock().await;
    if let Some(c) = conn.take() {
        for h in c.abort_handles {
            h.abort();
        }
        let _ = c.mqtt_client.disconnect().await;
    }
    Ok(())
}

#[tauri::command]
async fn get_status(state: TauriState<'_, AppState>) -> Result<PrinterStatus, String> {
    let conn = state.connection.lock().await;
    match &*conn {
        Some(c) => Ok(c.status.lock().await.clone()),
        None => Err("Not connected".into()),
    }
}

#[tauri::command]
async fn set_print_speed(level: u8, state: TauriState<'_, AppState>) -> Result<(), String> {
    let conn = state.connection.lock().await;
    let c = conn.as_ref().ok_or("Not connected")?;
    let topic = format!("device/{}/request", c.serial);
    let payload = serde_json::json!({
        "print": {
            "sequence_id": "0",
            "command": "print_speed",
            "param": level.to_string()
        }
    });
    c.mqtt_client
        .publish(&topic, QoS::AtLeastOnce, false, payload.to_string())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_chamber_light(on: bool, state: TauriState<'_, AppState>) -> Result<(), String> {
    let conn = state.connection.lock().await;
    let c = conn.as_ref().ok_or("Not connected")?;
    let topic = format!("device/{}/request", c.serial);
    let payload = serde_json::json!({
        "system": {
            "sequence_id": "0",
            "command": "ledctrl",
            "led_node": "chamber_light",
            "led_mode": if on { "on" } else { "off" },
            "led_on_time": 500,
            "led_off_time": 500,
            "loop_times": 0,
            "interval_time": 0
        }
    });
    c.mqtt_client
        .publish(&topic, QoS::AtLeastOnce, false, payload.to_string())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn send_gcode(gcode: String, state: TauriState<'_, AppState>) -> Result<(), String> {
    let conn = state.connection.lock().await;
    let c = conn.as_ref().ok_or("Not connected")?;
    let topic = format!("device/{}/request", c.serial);
    let payload = serde_json::json!({
        "print": {
            "sequence_id": "0",
            "command": "gcode_line",
            "param": gcode
        }
    });
    c.mqtt_client
        .publish(&topic, QoS::AtLeastOnce, false, payload.to_string())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn printer_command(command: String, state: TauriState<'_, AppState>) -> Result<(), String> {
    let conn = state.connection.lock().await;
    let c = conn.as_ref().ok_or("Not connected")?;
    let topic = format!("device/{}/request", c.serial);
    let payload = serde_json::json!({ "print": { "command": command } });
    c.mqtt_client
        .publish(&topic, QoS::AtLeastOnce, false, payload.to_string())
        .await
        .map_err(|e| e.to_string())
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState {
            connection: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            connect_printer,
            disconnect_printer,
            get_status,
            printer_command,
            set_chamber_light,
            set_print_speed,
            send_gcode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
