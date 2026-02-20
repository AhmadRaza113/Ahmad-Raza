-- Run in your Azure SQL database (Query editor or SSMS)

-- Main table
IF OBJECT_ID('dbo.AuditorRequests', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditorRequests (
    RowId uniqueidentifier NOT NULL PRIMARY KEY,
    ClientId int NOT NULL,

    AuditorRequest nvarchar(max) NULL,
    HostComments nvarchar(max) NULL,
    HostBackroomComments nvarchar(max) NULL,
    AssignedTo nvarchar(180) NULL,

    Status nvarchar(50) NULL,
    RequestedDepartment nvarchar(50) NULL,
    RequestType nvarchar(50) NULL,

    DueDateTime datetime2(0) NULL,
    ClientName nvarchar(190) NULL,
    ClosedTime datetime2(0) NULL,
    CompletedOn datetime2(0) NULL,
    ClientInternalId int NULL,

    UpdatedAt datetime2(0) NOT NULL DEFAULT sysutcdatetime(),
    UpdatedBy nvarchar(200) NULL,

    RowVer rowversion NOT NULL
  );

  CREATE INDEX IX_AuditorRequests_ClientId ON dbo.AuditorRequests(ClientId);
END
GO

-- Event log table (for auditing + optional polling sync)
IF OBJECT_ID('dbo.AuditorRequestEvents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditorRequestEvents (
    EventId bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ClientId int NOT NULL,
    RowId uniqueidentifier NOT NULL,
    ColId nvarchar(128) NULL,
    OldValue nvarchar(max) NULL,
    NewValue nvarchar(max) NULL,
    Action nvarchar(40) NOT NULL,
    ByUser nvarchar(200) NULL,
    AtUtc datetime2(0) NOT NULL DEFAULT sysutcdatetime()
  );

  CREATE INDEX IX_Events_Client_EventId ON dbo.AuditorRequestEvents(ClientId, EventId);
  CREATE INDEX IX_Events_Client_Row ON dbo.AuditorRequestEvents(ClientId, RowId, EventId DESC);
END
GO
