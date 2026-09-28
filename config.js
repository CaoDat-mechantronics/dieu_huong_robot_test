// ============================================================
// HIVE MQ CONFIG CHO WEB
// ============================================================
//
// HiveMQ Cloud:
// - MQTT TLS cho ESP32 thường dùng port 8883.
// - MQTT over secure WebSocket cho browser dùng port 8884.
// - WebSocket path mặc định: /mqtt.
//
// Ví dụ:
// const MQTT_URL =
//   "wss://xxxxxxxxxxxxxxxx.s1.eu.hivemq.cloud:8884/mqtt";
//
// Dùng credential có quyền publish topic/status.
// KHÔNG commit credential thật lên repository public.
// ============================================================

const MQTT_URL =
  "wss://20d0e023b23d4286a0527539aafdfe1e.s1.eu.hivemq.cloud:8884/mqtt";

const MQTT_USERNAME =
  "dat.cao";

const MQTT_PASSWORD =
  "Alc476qu14_99";

const MQTT_TOPIC =
  "topic/status";
