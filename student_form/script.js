"use strict";

const TOKEN = "90935068|-31949247768312526|90903978";
const DB_NAME = "SCHOOL-DB";
const RELATION_NAME = "STUDENT-TABLE";
const BASE_URL = "http://api.login2explore.com:5577";
const IRL_ENDPOINT = "/api/irl";
const IML_ENDPOINT = "/api/iml";

const form = document.getElementById("studentForm");
const rollNoInput = document.getElementById("rollNo");
const fullNameInput = document.getElementById("fullName");
const classInput = document.getElementById("studentClass");
const birthDateInput = document.getElementById("birthDate");
const addressInput = document.getElementById("address");
const enrollmentDateInput = document.getElementById("enrollmentDate");
const saveBtn = document.getElementById("saveBtn");
const updateBtn = document.getElementById("updateBtn");
const resetBtn = document.getElementById("resetBtn");
const alertContainer = document.getElementById("alertContainer");

let currentRecNo = null;

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  resetForm();
});

function bindEvents() {
  rollNoInput.addEventListener("blur", handleRollNoCheck);

  rollNoInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleRollNoCheck();
    }
  });

  saveBtn.addEventListener("click", saveStudent);
  updateBtn.addEventListener("click", updateStudent);
  resetBtn.addEventListener("click", resetForm);
}

function enableForm() {
  fullNameInput.disabled = false;
  classInput.disabled = false;
  birthDateInput.disabled = false;
  addressInput.disabled = false;
  enrollmentDateInput.disabled = false;
}

function disableForm() {
  fullNameInput.disabled = true;
  classInput.disabled = true;
  birthDateInput.disabled = true;
  addressInput.disabled = true;
  enrollmentDateInput.disabled = true;
}

function clearForm() {
  form.reset();
  form.classList.remove("was-validated");

  const fields = [
    rollNoInput,
    fullNameInput,
    classInput,
    birthDateInput,
    addressInput,
    enrollmentDateInput,
  ];

  fields.forEach((field) => {
    field.classList.remove("is-invalid");
    field.classList.remove("is-valid");
  });
}

function resetForm() {
  clearForm();

  rollNoInput.disabled = false;
  disableForm();

  saveBtn.disabled = true;
  updateBtn.disabled = true;
  resetBtn.disabled = true;

  currentRecNo = null;
  clearAlert();
  rollNoInput.focus();
}

function validateForm() {
  trimAllFields();
  form.classList.add("was-validated");

  const inputs = [
    rollNoInput,
    fullNameInput,
    classInput,
    birthDateInput,
    addressInput,
    enrollmentDateInput,
  ];

  let valid = true;
  inputs.forEach((input) => {
    if (!input.value.trim()) {
      input.setCustomValidity("Required");
      valid = false;
    } else {
      input.setCustomValidity("");
    }
  });

  if (!form.checkValidity()) {
    valid = false;
  }

  return valid;
}

function trimAllFields() {
  rollNoInput.value = rollNoInput.value.trim();
  fullNameInput.value = fullNameInput.value.trim();
  classInput.value = classInput.value.trim();
  addressInput.value = addressInput.value.trim();
}

async function handleRollNoCheck() {
  if (rollNoInput.disabled) {
    return;
  }

  rollNoInput.value = rollNoInput.value.trim();

  if (!rollNoInput.value) {
    showAlert("Please enter Roll-No to continue.", "warning");
    return;
  }

  clearAlert();
  resetBtn.disabled = false;

  const studentResult = await getStudent(rollNoInput.value);

  if (!studentResult.ok) {
    if (
      studentResult.errorType === "record-not-found" ||
      studentResult.errorType === "db-not-exists" ||
      studentResult.errorType === "relation-not-exists"
    ) {
      clearFormExceptRollNo();
      enableForm();
      saveBtn.disabled = false;
      updateBtn.disabled = true;
      resetBtn.disabled = false;
      if (studentResult.errorType !== "record-not-found") {
        showAlert(
          "Database/Relation not found yet. Enter details and click Save to create first record.",
          "info"
        );
      }
      fullNameInput.focus();
      return;
    }

    showAlert(studentResult.message, "danger");
    return;
  }

  currentRecNo = studentResult.recNo;
  fillForm(studentResult.record);

  rollNoInput.disabled = true;
  enableForm();

  saveBtn.disabled = true;
  updateBtn.disabled = false;
  resetBtn.disabled = false;

  fullNameInput.focus();
  showAlert("Existing student record loaded. You can update it now.", "info");
}

function clearFormExceptRollNo() {
  const rollNoValue = rollNoInput.value;
  clearForm();
  rollNoInput.value = rollNoValue;
}

async function getStudent(rollNo) {
  const payload = createGET_BY_KEYRequest(TOKEN, DB_NAME, RELATION_NAME, {
    "Roll-No": rollNo,
  });

  const response = await executeCommand(payload, IRL_ENDPOINT);

  if (!response.ok) {
    return response;
  }

  const data = response.data;
  const record = extractRecord(data);
  const recNo = extractRecNo(data) ?? extractRecNo(response.raw) ?? extractRecNo(response.raw?.data);

  if (!record) {
    return {
      ok: false,
      errorType: "record-not-found",
      message: "Record not found for this Roll-No.",
    };
  }

  return {
    ok: true,
    record,
    recNo,
  };
}

async function saveStudent() {
  if (!validateForm()) {
    showAlert("Please fill all mandatory fields before saving.", "warning");
    return;
  }

  const student = getStudentPayloadFromForm();

  const payload = createPUTRequest(TOKEN, DB_NAME, RELATION_NAME, student);
  const response = await executeCommand(payload, IML_ENDPOINT);

  if (!response.ok) {
    showAlert(response.message, "danger");
    return;
  }

  showAlert("Student record saved successfully.", "success");
  setTimeout(() => {
    resetForm();
  }, 700);
}

async function updateStudent() {
  if (!validateForm()) {
    showAlert("Please fill all mandatory fields before updating.", "warning");
    return;
  }

  const latest = await getStudent(rollNoInput.value.trim());
  if (!latest.ok || latest.recNo === null || latest.recNo === undefined) {
    showAlert("Unable to locate existing record for update. Re-enter Roll-No and try again.", "warning");
    return;
  }

  currentRecNo = latest.recNo;

  const student = getStudentPayloadFromForm();
  const payload = createUPDATERecordRequest(
    TOKEN,
    DB_NAME,
    RELATION_NAME,
    student,
    currentRecNo
  );

  if (!payload) {
    showAlert("Could not determine a valid record number for update. Re-enter Roll-No and try again.", "warning");
    return;
  }

  const response = await executeCommand(payload, IML_ENDPOINT);

  if (!response.ok) {
    if (response.errorType === "invalid-record-number") {
      const setPayload = createSETRequest(TOKEN, DB_NAME, RELATION_NAME, student, "UPDATE", "Roll-No");
      const setResponse = await executeCommand(setPayload, IML_ENDPOINT);
      if (!setResponse.ok) {
        showAlert(setResponse.message, "danger");
        return;
      }
      showAlert("Student record updated successfully.", "success");
      setTimeout(() => {
        resetForm();
      }, 700);
      return;
    }

    showAlert(response.message, "danger");
    return;
  }

  showAlert("Student record updated successfully.", "success");
  setTimeout(() => {
    resetForm();
  }, 700);
}

function fillForm(record) {
  rollNoInput.value = (record["Roll-No"] || "").toString();
  fullNameInput.value = (record["Full-Name"] || "").toString();
  classInput.value = (record["Class"] || "").toString();
  birthDateInput.value = (record["Birth-Date"] || "").toString();
  addressInput.value = (record["Address"] || "").toString();
  enrollmentDateInput.value = (record["Enrollment-Date"] || "").toString();
}

function getStudentPayloadFromForm() {
  trimAllFields();
  return {
    "Roll-No": rollNoInput.value,
    "Full-Name": fullNameInput.value,
    "Class": classInput.value,
    "Birth-Date": birthDateInput.value,
    "Address": addressInput.value,
    "Enrollment-Date": enrollmentDateInput.value,
  };
}

function createGET_BY_KEYRequest(token, dbName, relationName, keyObj) {
  return {
    token,
    cmd: "GET_BY_KEY",
    dbName,
    rel: relationName,
    jsonStr: keyObj,
  };
}

function createPUTRequest(token, dbName, relationName, recordObj) {
  return {
    token,
    cmd: "PUT",
    dbName,
    rel: relationName,
    jsonStr: recordObj,
  };
}

function createUPDATERecordRequest(token, dbName, relationName, recordObj, recNo) {
  const normalizedRecNo = Number(recNo);
  if (!Number.isFinite(normalizedRecNo)) {
    return null;
  }
  return {
    token,
    cmd: "UPDATE",
    dbName,
    rel: relationName,
    jsonStr: {
      [normalizedRecNo]: recordObj,
    },
  };
}

function createSETRequest(token, dbName, relationName, recordObj, type, primaryKey) {
  return {
    token,
    cmd: "SET",
    dbName,
    rel: relationName,
    type,
    primaryKey,
    jsonStr: recordObj,
  };
}

async function executeCommand(requestPayload, endpointPath) {
  if (!TOKEN || TOKEN === "YOUR_CONNECTION_TOKEN") {
    return {
      ok: false,
      errorType: "invalid-token",
      message: "Please set a valid JPDB connection token in script.js.",
    };
  }

  if (window.location.protocol === "https:" && BASE_URL.startsWith("http://")) {
    return {
      ok: false,
      errorType: "mixed-content",
      message:
        "Browser blocked the request (mixed content). Open this app on HTTP/local file or use an HTTPS JPDB endpoint if available.",
    };
  }

  try {
    const response = await fetch(`${BASE_URL}${endpointPath}`, {
      method: "POST",
      body: JSON.stringify(requestPayload),
    });

    const responseJson = await response.json().catch(() => ({}));

    if (!response.ok) {
      return normalizeError(response.status, responseJson);
    }

    if (responseJson.status && Number(responseJson.status) >= 400) {
      return normalizeError(Number(responseJson.status), responseJson);
    }

    return {
      ok: true,
      data: parsePossiblyStringified(responseJson.data),
      raw: responseJson,
    };
  } catch (error) {
    const detail = error && error.message ? ` Details: ${error.message}` : "";
    return {
      ok: false,
      errorType: "network-error",
      message:
        "Network error: unable to connect to JsonPowerDB server. Check internet, CORS/mixed-content policy, or server availability." +
        detail,
      details: error,
    };
  }
}

function normalizeError(statusCode, errorResponse) {
  const message = extractErrorMessage(errorResponse);
  const lower = message.toLowerCase();

  if (lower.includes("token") || statusCode === 401 || statusCode === 403) {
    return {
      ok: false,
      errorType: "invalid-token",
      message: "Invalid token. Please verify your JPDB connection token.",
      raw: errorResponse,
    };
  }

  if (lower.includes("duplicate") || lower.includes("already exists")) {
    return {
      ok: false,
      errorType: "duplicate-record",
      message: "Duplicate record: this Roll-No already exists.",
      raw: errorResponse,
    };
  }

  if (lower.includes("database does not exist") || lower.includes("db does not exist")) {
    return {
      ok: false,
      errorType: "db-not-exists",
      message: "Database does not exist yet. Save the first record to create it.",
      raw: errorResponse,
    };
  }

  if (lower.includes("relation does not exist") || lower.includes("table does not exist")) {
    return {
      ok: false,
      errorType: "relation-not-exists",
      message: "Relation does not exist yet. Save the first record to create it.",
      raw: errorResponse,
    };
  }

  if (lower.includes("invalid record number") || lower.includes("record number")) {
    return {
      ok: false,
      errorType: "invalid-record-number",
      message: "Invalid record number for update. Please re-enter Roll-No to load the latest record, then update again.",
      raw: errorResponse,
    };
  }

  if (lower.includes("not found") || lower.includes("no data") || statusCode === 404) {
    return {
      ok: false,
      errorType: "record-not-found",
      message: "Record not found for this Roll-No.",
      raw: errorResponse,
    };
  }

  return {
    ok: false,
    errorType: "server-error",
    message: `Server error (${statusCode || "unknown"}): ${message || "Unexpected response."}`,
    raw: errorResponse,
  };
}

function parsePossiblyStringified(value) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractErrorMessage(errorResponse) {
  if (!errorResponse) {
    return "Unknown error";
  }

  if (typeof errorResponse === "string") {
    return errorResponse;
  }

  const candidates = [
    errorResponse.message,
    errorResponse.error,
    errorResponse.data,
    errorResponse.info,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (typeof candidate === "string") {
      return candidate;
    }

    if (typeof candidate === "object" && candidate.message) {
      return String(candidate.message);
    }
  }

  return JSON.stringify(errorResponse);
}

function extractRecord(data) {
  if (!data) {
    return null;
  }

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (first && typeof first === "object") {
      if (first.record && typeof first.record === "object") {
        return first.record;
      }
      if (first.jsonStr && typeof first.jsonStr === "object") {
        return first.jsonStr;
      }
    }
  }

  if (data.record && typeof data.record === "object") {
    return data.record;
  }

  if (data.jsonStr) {
    const jsonStrData = parsePossiblyStringified(data.jsonStr);
    if (jsonStrData && typeof jsonStrData === "object") {
      return jsonStrData;
    }
  }

  if (data.data && data.data.record && typeof data.data.record === "object") {
    return data.data.record;
  }

  return null;
}

function extractRecNo(data) {
  if (!data) {
    return null;
  }

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (!first || typeof first !== "object") {
      return null;
    }
    if (first.rec_no !== undefined) {
      return first.rec_no;
    }
    if (first.recNo !== undefined) {
      return first.recNo;
    }
    if (first.record && typeof first.record === "object") {
      if (first.record.rec_no !== undefined) {
        return first.record.rec_no;
      }
      if (first.record.recNo !== undefined) {
        return first.record.recNo;
      }
    }
  }

  if (data.rec_no !== undefined) {
    return data.rec_no;
  }

  if (data.recNo !== undefined) {
    return data.recNo;
  }

  if (data.record && data.record.rec_no !== undefined) {
    return data.record.rec_no;
  }

  return null;
}

function showAlert(message, type = "info") {
  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

function clearAlert() {
  alertContainer.innerHTML = "";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
