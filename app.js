// ============================================================
// ROBOT TURN WEB
// topic/status:
//   0 = STOP / IDLE
//   1 = QUAY TRÁI
//   2 = QUAY PHẢI
//   3 = BÁM LINE
//   4 = RẼ TRÁI
//   5 = RẼ PHẢI
//
// Cấu hình phiên quay được lưu tạm vào localStorage.
// Khi quay hoàn tất hoặc dừng khẩn cấp:
//   - xóa localStorage của phiên quay
//   - reset targetAngle = 0
//   - reset stopLead = 0
//   - reset angleTurned = 0
//   - reset startAlpha / previousAlpha
//   - reset stopSent = false
//   - reset isTurning = false
// ============================================================


// ============================================================
// MQTT STATE
// ============================================================

let client = null;
let mqttConnected = false;


// ============================================================
// SENSOR STATE
// ============================================================

let sensorEnabled = false;

// Alpha hiện tại của điện thoại: 0..360 độ.
// Đây là dữ liệu sensor sống nên KHÔNG reset về 0 sau phiên quay.
let currentAlpha = null;


// ============================================================
// TURN SESSION STATE
// ============================================================

let isTurning = false;
let isLineFollowing = false;

let targetAngle = 0;
let stopLead = 0;

let startAlpha = null;
let previousAlpha = null;

let angleTurned = 0;

// false = chưa gửi STOP
// true  = đã khóa việc gửi STOP lặp trong phiên hiện tại
let stopSent = false;


// ============================================================
// LOCAL STORAGE KEYS
// ============================================================

const STORAGE_KEYS = {
  direction: "robot_turn_direction",
  targetAngle: "robot_turn_target_angle",
  stopLead: "robot_turn_stop_lead"
};


// ============================================================
// DOM
// ============================================================

const $ =
  (id) =>
    document.getElementById(id);


const mqttStatus =
  $("mqttStatus");

const sensorStatus =
  $("sensorStatus");

const turnStatus =
  $("turnStatus");


const directionInput =
  $("direction");

const targetAngleInput =
  $("targetAngle");

const stopLeadInput =
  $("stopLead");

const targetAngleField =
  $("targetAngleField");

const stopLeadField =
  $("stopLeadField");


const alphaValue =
  $("alphaValue");

const startValue =
  $("startValue");

const turnedValue =
  $("turnedValue");

const targetDisplay =
  $("targetDisplay");

const progressBar =
  $("progressBar");

const stopSentValue =
  $("stopSentValue");

const lastPayload =
  $("lastPayload");

const message =
  $("message");


const connectBtn =
  $("connectBtn");

const sensorBtn =
  $("sensorBtn");

const turnBtn =
  $("turnBtn");

const stopBtn =
  $("stopBtn");


// ============================================================
// LOCAL STORAGE
// ============================================================

function saveSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.direction,
      directionInput.value
    );

    localStorage.setItem(
      STORAGE_KEYS.targetAngle,
      targetAngleInput.value
    );

    localStorage.setItem(
      STORAGE_KEYS.stopLead,
      stopLeadInput.value
    );

  } catch (error) {
    console.warn(
      "Không thể lưu localStorage:",
      error
    );
  }
}


function loadSettings() {
  try {
    const savedDirection =
      localStorage.getItem(
        STORAGE_KEYS.direction
      );

    const savedTargetAngle =
      localStorage.getItem(
        STORAGE_KEYS.targetAngle
      );

    const savedStopLead =
      localStorage.getItem(
        STORAGE_KEYS.stopLead
      );


    if (
      savedDirection === "1" ||
      savedDirection === "2" ||
      savedDirection === "3" ||
      savedDirection === "4" ||
      savedDirection === "5"
    ) {
      directionInput.value =
        savedDirection;
    }


    if (
      savedTargetAngle !== null
    ) {
      const value =
        Number(savedTargetAngle);

      if (
        Number.isFinite(value) &&
        value >= 1 &&
        value <= 720
      ) {
        targetAngleInput.value =
          String(value);
      }
    }


    if (
      savedStopLead !== null
    ) {
      const value =
        Number(savedStopLead);

      if (
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 30
      ) {
        stopLeadInput.value =
          String(value);
      }
    }

  } catch (error) {
    console.warn(
      "Không thể đọc localStorage:",
      error
    );
  }
}


// Chỉ xóa dữ liệu liên quan chức năng quay.
// Không dùng localStorage.clear() vì có thể xóa dữ liệu khác của web.
function clearSavedSettings() {
  try {
    localStorage.removeItem(
      STORAGE_KEYS.direction
    );

    localStorage.removeItem(
      STORAGE_KEYS.targetAngle
    );

    localStorage.removeItem(
      STORAGE_KEYS.stopLead
    );

  } catch (error) {
    console.warn(
      "Không thể xóa localStorage:",
      error
    );
  }
}


// ============================================================
// RESET PHIÊN QUAY
// ============================================================

function resetTurnSession() {

  // Xóa localStorage.
  clearSavedSettings();


  // Reset biến JavaScript.
  isTurning = false;
  isLineFollowing = false;

  targetAngle = 0;
  stopLead = 0;

  startAlpha = null;
  previousAlpha = null;

  angleTurned = 0;

  stopSent = false;


  // Reset form.
  // Direction không có 0 nên quay về lựa chọn mặc định = trái.
  directionInput.value = "1";

  targetAngleInput.value = "0";
  stopLeadInput.value = "0";


  // Reset UI.
  turnStatus.textContent =
    "IDLE";

  turnBtn.disabled =
    false;

  // Lệnh cuối cùng đã gửi cho robot là STOP.
  lastPayload.textContent =
    "0";

  syncModeUi();
  updateUi();
}


// ============================================================
// UI
// ============================================================

function setMessage(text) {
  message.textContent =
    text;
}


function setMqttStatus(ok) {

  mqttConnected = ok;

  mqttStatus.textContent =
    ok
      ? "Đã kết nối"
      : "Chưa kết nối";

  mqttStatus.classList.toggle(
    "good",
    ok
  );

  mqttStatus.classList.toggle(
    "bad",
    !ok
  );
}


function setSensorStatus(ok) {

  sensorEnabled = ok;

  sensorStatus.textContent =
    ok
      ? "Đã bật"
      : "Chưa bật";

  sensorStatus.classList.toggle(
    "good",
    ok
  );

  sensorStatus.classList.toggle(
    "bad",
    !ok
  );
}


function updateUi() {

  alphaValue.textContent =
    currentAlpha == null
      ? "--"
      : currentAlpha.toFixed(1);


  startValue.textContent =
    startAlpha == null
      ? "--"
      : startAlpha.toFixed(1);


  turnedValue.textContent =
    angleTurned.toFixed(1);


  const displayTarget =
    Number(
      targetAngleInput.value || 0
    );


  targetDisplay.textContent =
    Number.isFinite(displayTarget)
      ? displayTarget.toFixed(0)
      : "0";


  stopSentValue.textContent =
    String(stopSent);


  const safeTarget =
    Math.max(
      1,
      Number.isFinite(displayTarget)
        ? displayTarget
        : 1
    );


  const percent =
    displayTarget > 0
      ? Math.min(
          100,
          (angleTurned / safeTarget) * 100
        )
      : 0;


  progressBar.style.width =
    `${percent}%`;
}


function syncModeUi() {
  const isLineMode =
    directionInput.value === "3";

  targetAngleInput.disabled =
    isLineMode;

  stopLeadInput.disabled =
    isLineMode;

  targetAngleField.classList.toggle(
    "mode-disabled",
    isLineMode
  );

  stopLeadField.classList.toggle(
    "mode-disabled",
    isLineMode
  );

  if (isLineMode && !isLineFollowing) {
    setMessage(
      "Bám line không cần cảm biến góc điện thoại. Nhấn XÁC NHẬN để gửi topic/status = 3."
    );
  }
}


// ============================================================
// MQTT
// ============================================================

function createClientId() {

  return (
    "robot-turn-web-" +
    Date.now().toString(16) +
    "-" +
    Math.random()
      .toString(16)
      .slice(2, 8)
  );
}


function connectMqtt() {

  if (
    typeof mqtt === "undefined"
  ) {
    setMessage(
      "Không tải được MQTT.js."
    );

    return;
  }


  if (
    !MQTT_URL ||
    MQTT_URL.includes(
      "YOUR_HIVEMQ_HOST"
    )
  ) {
    setMessage(
      "Hãy sửa web/config.js trước: MQTT_URL, username và password."
    );

    return;
  }


  if (
    client &&
    client.connected
  ) {
    setMessage(
      "MQTT đã kết nối."
    );

    return;
  }


  setMessage(
    "Đang kết nối HiveMQ..."
  );


  client =
    mqtt.connect(
      MQTT_URL,
      {
        username:
          MQTT_USERNAME,

        password:
          MQTT_PASSWORD,

        clientId:
          createClientId(),

        clean: true,

        reconnectPeriod:
          2000,

        connectTimeout:
          10000,

        protocolVersion:
          4
      }
    );


  client.on(
    "connect",
    () => {
      setMqttStatus(true);

      setMessage(
        "Đã kết nối HiveMQ."
      );
    }
  );


  client.on(
    "reconnect",
    () => {
      setMqttStatus(false);

      setMessage(
        "Đang reconnect HiveMQ..."
      );
    }
  );


  client.on(
    "close",
    () => {
      setMqttStatus(false);

      if (isTurning || isLineFollowing) {

        resetTurnSession();

        setMessage(
          "Mất MQTT khi robot đang hoạt động. Đã reset phiên; ESP32 sẽ tự STOP do fail-safe."
        );
      }
    }
  );


  client.on(
    "error",
    (error) => {
      console.error(
        "MQTT error:",
        error
      );

      setMessage(
        "Lỗi MQTT. Kiểm tra URL / credential / quyền topic."
      );
    }
  );
}


// state:
// 0 = STOP
// 1 = LEFT
// 2 = RIGHT
// 3 = LINE FOLLOW
function publishState(
  state,
  callback = null
) {

  if (
    !client ||
    !client.connected
  ) {
    throw new Error(
      "MQTT chưa kết nối."
    );
  }


  const payload =
    String(state);


  lastPayload.textContent =
    payload;


  client.publish(
    MQTT_TOPIC,
    payload,
    {
      qos: 1,
      retain: false
    },
    (error) => {

      if (error) {
        console.error(
          "Publish error:",
          error
        );
      }

      if (callback) {
        callback(error);
      }
    }
  );
}


// ============================================================
// SENSOR
// ============================================================

async function enableSensor() {

  try {

    if (
      typeof DeviceOrientationEvent !==
        "undefined" &&
      typeof
        DeviceOrientationEvent
          .requestPermission ===
        "function"
    ) {

      const permission =
        await DeviceOrientationEvent
          .requestPermission();


      if (
        permission !== "granted"
      ) {
        throw new Error(
          "Bạn chưa cấp quyền cảm biến."
        );
      }
    }


    window.removeEventListener(
      "deviceorientation",
      handleOrientation,
      true
    );


    window.addEventListener(
      "deviceorientation",
      handleOrientation,
      true
    );


    setMessage(
      "Đang chờ dữ liệu góc..."
    );


    setTimeout(
      () => {

        if (
          currentAlpha == null
        ) {
          setMessage(
            "Chưa nhận được alpha. Kiểm tra HTTPS và quyền cảm biến."
          );
        }

      },
      1500
    );

  } catch (error) {

    console.error(error);

    setSensorStatus(false);

    setMessage(
      error.message ||
      "Không bật được cảm biến."
    );
  }
}


function normalize360(angle) {

  return (
    (angle % 360) + 360
  ) % 360;
}


function shortestSignedDelta(
  current,
  previous
) {

  return (
    (
      current -
      previous +
      540
    ) %
    360
  ) - 180;
}


function handleOrientation(event) {

  if (
    event.alpha == null ||
    Number.isNaN(event.alpha)
  ) {
    return;
  }


  currentAlpha =
    normalize360(
      Number(event.alpha)
    );


  if (!sensorEnabled) {

    setSensorStatus(true);

    setMessage(
      "Đã nhận dữ liệu góc."
    );
  }


  if (!isTurning) {

    updateUi();

    return;
  }


  if (
    previousAlpha == null
  ) {

    previousAlpha =
      currentAlpha;

    updateUi();

    return;
  }


  const delta =
    shortestSignedDelta(
      currentAlpha,
      previousAlpha
    );


  previousAlpha =
    currentAlpha;


  if (
    Math.abs(delta) < 0.08
  ) {

    updateUi();

    return;
  }


  if (
    Math.abs(delta) > 45
  ) {

    updateUi();

    return;
  }


  angleTurned +=
    Math.abs(delta);


  updateUi();

  checkTarget();
}


// ============================================================
// TURN
// ============================================================

function validateTurnInputs() {

  const requestedTarget =
    Number(
      targetAngleInput.value
    );


  const requestedLead =
    Number(
      stopLeadInput.value
    );


  if (
    !Number.isFinite(
      requestedTarget
    ) ||
    requestedTarget < 1 ||
    requestedTarget > 720
  ) {
    throw new Error(
      "Góc mục tiêu phải từ 1° đến 720°."
    );
  }


  if (
    !Number.isFinite(
      requestedLead
    ) ||
    requestedLead < 0 ||
    requestedLead > 30
  ) {
    throw new Error(
      "Bù dừng phải từ 0° đến 30°."
    );
  }


  return {
    requestedTarget,
    requestedLead
  };
}


function startTurn() {

  try {

    if (isTurning || isLineFollowing) {
      return;
    }


    if (!mqttConnected) {
      throw new Error(
        "Hãy kết nối HiveMQ trước."
      );
    }


    if (
      !sensorEnabled ||
      currentAlpha == null
    ) {
      throw new Error(
        "Hãy bật cảm biến góc trước."
      );
    }


    const {
      requestedTarget,
      requestedLead
    } =
      validateTurnInputs();


    targetAngle =
      requestedTarget;


    stopLead =
      Math.min(
        requestedLead,
        Math.max(
          0,
          targetAngle - 0.5
        )
      );


    // Reset cho phiên mới.
    isTurning =
      true;

    stopSent =
      false;

    startAlpha =
      currentAlpha;

    previousAlpha =
      currentAlpha;

    angleTurned =
      0;


    // Lưu cấu hình hiện tại.
    saveSettings();


    turnBtn.disabled =
      true;


    const command =
      Number(
        directionInput.value
      );


    const commandLabels = {
      1: "QUAY TRÁI",
      2: "QUAY PHẢI",
      4: "RẼ TRÁI",
      5: "RẼ PHẢI"
    };


    turnStatus.textContent =
      commandLabels[command] ||
      "ĐANG CHẠY";


    updateUi();


    // Chỉ gửi lệnh quay một lần.
    publishState(
      command,
      (error) => {

        if (error) {

          resetTurnSession();

          setMessage(
            "Không gửi được lệnh quay. Đã reset phiên."
          );
        }
      }
    );


    const commandMessages = {
      1: `Đã gửi 1 = QUAY TRÁI. Mục tiêu ${targetAngle}°.`,
      2: `Đã gửi 2 = QUAY PHẢI. Mục tiêu ${targetAngle}°.`,
      4: `Đã gửi 4 = RẼ TRÁI. Mục tiêu ${targetAngle}°.`,
      5: `Đã gửi 5 = RẼ PHẢI. Mục tiêu ${targetAngle}°.`
    };


    setMessage(
      commandMessages[command] ||
      `Đã gửi status ${command}. Mục tiêu ${targetAngle}°.`
    );

  } catch (error) {

    setMessage(
      error.message ||
      "Không thể bắt đầu quay."
    );
  }
}


function startLineFollow() {
  try {
    if (isTurning || isLineFollowing) {
      return;
    }

    if (!mqttConnected) {
      throw new Error(
        "Hãy kết nối HiveMQ trước."
      );
    }

    isLineFollowing = true;
    isTurning = false;
    stopSent = false;

    saveSettings();

    turnBtn.disabled = true;
    turnStatus.textContent =
      "BÁM LINE";

    publishState(
      3,
      (error) => {
        if (error) {
          resetTurnSession();
          setMessage(
            "Không gửi được lệnh bám line. Đã reset phiên."
          );
        }
      }
    );

    lastPayload.textContent =
      "3";

    setMessage(
      "Đã gửi 3 = BÁM LINE. ESP32 đang tự đọc IR trái GPIO 33 và IR phải GPIO 32. Nhấn DỪNG KHẨN CẤP để thoát."
    );
  } catch (error) {
    setMessage(
      error.message ||
      "Không thể bắt đầu bám line."
    );
  }
}


function confirmCommand() {
  if (directionInput.value === "3") {
    startLineFollow();
    return;
  }

  startTurn();
}


function checkTarget() {

  if (!isTurning) {
    return;
  }


  const stopThreshold =
    Math.max(
      0.5,
      targetAngle -
      stopLead
    );


  if (
    angleTurned >=
      stopThreshold &&
    stopSent === false
  ) {

    // Khóa trước để callback sensor tiếp theo
    // không thể gửi STOP lần thứ hai.
    stopSent =
      true;

    isTurning =
      false;


    // Lưu góc hoàn thành trước khi reset.
    const completedAngle =
      angleTurned;


    turnStatus.textContent =
      "ĐANG GỬI STOP";


    updateUi();


    try {

      publishState(
        0,
        (error) => {

          if (error) {

            resetTurnSession();

            setMessage(
              "Đạt góc nhưng publish STOP báo lỗi. Đã reset dữ liệu frontend."
            );

            return;
          }


          // STOP đã gửi thành công.
          // Xóa localStorage và reset toàn bộ phiên.
          resetTurnSession();


          setMessage(
            `Hoàn tất ở ${completedAngle.toFixed(1)}°. ` +
            `Đã gửi topic/status = 0 và xóa dữ liệu phiên khỏi localStorage.`
          );
        }
      );

    } catch (error) {

      resetTurnSession();

      setMessage(
        "Đạt góc nhưng MQTT đã mất kết nối. Đã reset frontend; ESP32 có fail-safe."
      );
    }
  }
}


// ============================================================
// EMERGENCY STOP
// ============================================================

function emergencyStop() {

  const stoppedAngle =
    angleTurned;

  const wasLineFollowing =
    isLineFollowing;


  stopSent =
    true;

  isTurning =
    false;

  isLineFollowing =
    false;


  updateUi();


  try {

    publishState(
      0,
      (error) => {

        // Dù STOP thành công hay lỗi,
        // phiên frontend vẫn phải được reset.
        resetTurnSession();


        if (error) {

          setMessage(
            "Không gửi được STOP. Đã reset dữ liệu frontend."
          );

        } else {

          setMessage(
            wasLineFollowing
              ? "Đã STOP và thoát chế độ BÁM LINE."
              : `Đã STOP tại ${stoppedAngle.toFixed(1)}° và xóa dữ liệu phiên.`
          );
        }
      }
    );

  } catch (error) {

    resetTurnSession();

    setMessage(
      "MQTT chưa kết nối. Đã reset dữ liệu frontend."
    );
  }
}


// ============================================================
// PAGE SAFETY
// ============================================================

function bestEffortStop() {

  if (
    (!isTurning && !isLineFollowing) ||
    !client ||
    !client.connected
  ) {
    return;
  }


  try {

    stopSent =
      true;

    isTurning =
      false;

    isLineFollowing =
      false;


    client.publish(
      MQTT_TOPIC,
      "0",
      {
        qos: 1,
        retain: false
      }
    );


    clearSavedSettings();

  } catch (_) {}
}


// ============================================================
// EVENTS
// ============================================================

connectBtn.addEventListener(
  "click",
  connectMqtt
);


sensorBtn.addEventListener(
  "click",
  enableSensor
);


turnBtn.addEventListener(
  "click",
  confirmCommand
);


stopBtn.addEventListener(
  "click",
  emergencyStop
);


// Lưu hướng.
directionInput.addEventListener(
  "change",
  () => {
    saveSettings();
    syncModeUi();
  }
);


// Lưu góc mục tiêu.
targetAngleInput.addEventListener(
  "input",
  () => {
    saveSettings();
    updateUi();
  }
);


// Lưu bù dừng.
stopLeadInput.addEventListener(
  "input",
  () => {
    saveSettings();
  }
);


// Nếu tab bị ẩn trong khi quay -> STOP.
document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.hidden &&
      (isTurning || isLineFollowing)
    ) {
      emergencyStop();
    }
  }
);


// Khi đóng trang -> cố gắng STOP.
window.addEventListener(
  "pagehide",
  bestEffortStop
);


// ============================================================
// INITIALIZATION
// ============================================================

// Nếu phiên trước chưa hoàn tất thì lấy lại giá trị đã nhập.
loadSettings();

// Đồng bộ UI theo chế độ đã lưu.
syncModeUi();

// Cập nhật giao diện.
updateUi();