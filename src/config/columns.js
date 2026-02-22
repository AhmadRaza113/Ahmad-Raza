/**
 * Default column definitions for the Auditor Request Tracker grid.
 * Each column has: id, name, type, readOnly, width, and optional options (for choice/person).
 */
export const DEFAULT_COLS = [
  { id: "auditor_request", name: "Auditor's Request", type: "multiline", readOnly: false, width: 300 },
  { id: "host_comments", name: "Host Comments", type: "multiline", readOnly: false, width: 260 },
  { id: "host_backroom_comments", name: "Host/Backroom comments", type: "multiline", readOnly: false, width: 300 },
  { id: "assigned_to", name: "Assigned To", type: "person", readOnly: false, width: 190, options: ["Ali", "Ayesha", "Hamza", "Fatima"] },

  { id: "status", name: "Status", type: "choice", readOnly: false, width: 150, options: ["Open", "In Progress", "Blocked", "Done", "Closed"] },
  { id: "requested_department", name: "Requested Department", type: "choice", readOnly: false, width: 210, options: ["QA", "Ops", "Finance", "IT", "HR"] },
  { id: "request_type", name: "Request Type", type: "choice", readOnly: false, width: 170, options: ["Audit", "Task", "Complaint", "Change", "Other"] },

  { id: "due_datetime", name: "Due Date/Time", type: "datetime", readOnly: true, width: 190 },
  { id: "client_name", name: "Client Name", type: "text", readOnly: true, width: 190 },
  { id: "closed_time", name: "Closed Time", type: "datetime", readOnly: true, width: 190 },
  { id: "completed_on", name: "CompletedOn", type: "datetime", readOnly: true, width: 190 },
  { id: "client_id", name: "Client ID", type: "number", readOnly: true, width: 120 },
];
