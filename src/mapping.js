// Grid colIds -> SQL column names (ONLY these are allowed to be updated)
const COL_MAP = Object.freeze({
  auditor_request: "AuditorRequest",
  host_comments: "HostComments",
  host_backroom_comments: "HostBackroomComments",
  assigned_to: "AssignedTo",
  status: "Status",
  requested_department: "RequestedDepartment",
  request_type: "RequestType"
  // Read-only columns are intentionally NOT editable here
});

const SELECT_SQL = `
SELECT
  RowId,
  ClientId,
  SeqNum,
  ReqNo,
  AuditorRequest,
  HostComments,
  HostBackroomComments,
  AssignedTo,
  Status,
  RequestedDepartment,
  RequestType,
  DueDateTime,
  ClientName,
  ClosedTime,
  CompletedOn,
  ClientInternalId,
  UpdatedAt,
  UpdatedBy,
  RowVer
FROM dbo.AuditorRequests
WHERE ClientId = @clientId
ORDER BY UpdatedAt DESC, RowId ASC;
`;

function toGridRow(r) {
  return {
    id: r.RowId,
    // Auto-number computed column (e.g., "MA-01", "MA-100")
    reqNo: r.ReqNo ?? null,
    seqNum: r.SeqNum ?? null,
    clientId: r.ClientId,
    rowVer: r.RowVer ? Buffer.from(r.RowVer).toString("base64") : null,
    updatedAt: r.UpdatedAt ? new Date(r.UpdatedAt).toISOString() : null,
    updatedBy: r.UpdatedBy ?? null,
    values: {
      auditor_request: r.AuditorRequest ?? "",
      host_comments: r.HostComments ?? "",
      host_backroom_comments: r.HostBackroomComments ?? "",
      assigned_to: r.AssignedTo ?? "",
      status: r.Status ?? "",
      requested_department: r.RequestedDepartment ?? "",
      request_type: r.RequestType ?? "",

      due_datetime: r.DueDateTime ? toLocalDatetimeNoSeconds(r.DueDateTime) : "",
      client_name: r.ClientName ?? "",
      closed_time: r.ClosedTime ? toLocalDatetimeNoSeconds(r.ClosedTime) : "",
      completed_on: r.CompletedOn ? toLocalDatetimeNoSeconds(r.CompletedOn) : "",
      client_id: r.ClientInternalId ?? ""
    }
  };
}

// SQL datetime2 -> "YYYY-MM-DDTHH:mm"
function toLocalDatetimeNoSeconds(dt) {
  const d = new Date(dt);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

module.exports = { COL_MAP, SELECT_SQL, toGridRow };
