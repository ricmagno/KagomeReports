# About system driver and system tags
HMI and SCADASystem PlatformHistorian 2023 R2 SP1 P03
The system driver is an internal process that monitors key variables within an operating AVEVA Historian and outputs the values by means of a set of system tags. The system driver runs as a Windows service and starts automatically when the Historian is started.
The system tags are automatically created when you install the Historian. Also, additional system tags are created for each IDAS and replication server you configure.
The current value for an analog system tag is sent to the Storage subsystem according to a specified rate, in milliseconds. All date/time tags report the local time for the Historian.
Legacy tags from upgraded systems may be retained.


## Error count tags
HMI and SCADASystem PlatformHistorian 2023 R2 SP1 P03
The following analog tags have a storage rate of 1 minute (60000 ms). All error counts are since the AVEVA Historian is restarted or since or the last error count reset.

| TagName | Description |
|---------|-------------|
| SysCritErrCnt | Number of critical errors |
| SysErrErrCnt | Number of non-fatal errors |
| SysFatalErrCnt | Number of fatal errors |
| SysWarnErrCnt | Number of warnings |

## Date tags
HMI and SCADASystem PlatformHistorian 2023 R2 SP1 P03
The following analog tags have a storage rate of 5 minutes (300000 ms).

| TagName | Description |
|---------|-------------|
| SysDateDay | Day of the month |
| SysDateMonth | Month of the year |
| SysDateYear | Four-digit year |

## Time tags
HMI and SCADASystem PlatformHistorian 2023 R2 SP1 P03
All of the following tags are analog tags. Each value change is stored (delta storage).

| TagName | Description |
|---------|-------------|
| SysTimeHour | Hour of the day |
| SysTimeMin | Minute of the hour |
| SysTimeSec | Second of the minute |

## Storage space tags
HMI and SCADASystem PlatformHistorian 2023 R2 SP1 P03
The following analog tags have a storage rate of 5 minutes (300000 milliseconds). Space remaining is measured in MB.

| TagName | Description |
|---------|-------------|
| SysSpaceAlt | Space left in the alternate storage path |
| SysSpaceBuffer | Space left in the buffer storage path |
| SysSpaceMain | Space left in the circular storage path |
| SysSpacePerm | Space left in the permanent storage path |

## I/O statistics tags
HMI and SCADASystem PlatformHistorian 2023 R2 SP1 P03
The following analog tags can be used to monitor key I/O information.

| TagName | Description |
|---------|-------------|
| SysDataAcqNBadValues* | Number of data values with bad quality received. This tag has a storage rate of 5 seconds. The maximum is 1,000,000. |
| SysDataAcqNOutsideRealtime* | The number of values per second that were discarded because they arrived outside of the real-time data window. This tag has a storage rate of 5 seconds. The maximum is 1,000,000. This tag has been deprecated and will only be available in systems migrated from AVEVA Historian 2014 and earlier. |
| SysDataAcqOverallItemsPerSec | The number of items received from all data sources, including HCAP. This tag has a storage rate of 10 seconds. The maximum is 100,000. |
| SysDataAcqRxItemPerSecN* | Tag value update received per second. This tag has a storage rate of 10 seconds. |
| SysDataAcqRxTotalItemsN* | Total number of tag updates received since last startup for this IDAS. This tag has a storage rate of 10 seconds. |
| SysPerfDataAcqNBadValues* | Number of data values with bad quality received. This tag has a storage rate of 5 seconds. The maximum is 1,000,000. |
| SysStatusAverageEventCommitSize | Number of events written to the A2ALMDB database per minute. |
| SysStatusAverageEventCommitTime | Average time, in seconds, it takes to write events to the A2ALMDB database. |
| SysStatusEventCommitPending | Number of events that have not yet been written to the A2ALMDB database. |
| SysStatusRxEventsPerSec | Number of events received per second, calculated every 10 seconds. |
| SysStatusRxItemsPerSec | Tag value update received per second for the system driver. This tag has a storage rate of 10 seconds. |
| SysStatusRxTotalDuplicateEvents | Total number of duplicate events received through different channels since startup (and discarded as duplicates). |
| SysStatusRxTotalEvents | Total number of events received since startup. |
| SysStatusRxTotalItems | Total number of tag updates received since last startup for the system driver. This tag has a storage rate of 10 seconds. |
| SysStatusTopicsRxData | Total number of topics receiving data. Each active IDAS "topic" and each active HCAL connection are counted. Note that process and event history, even from the same source, count as separate connections. |

*This status tag will exist for each defined IDAS. The identifying number (N) in the is the IODriverKey from the IODriver table. The number 0 designates MDAS and only applies to the SysDataAcqNBadValues and SysDataAcqNOutsideRealtime tags.

## System monitoring tags
HMI and SCADASystem PlatformHistorian 2023 R2 SP1 P03
Unless otherwise noted, for the following discrete tags, 0 = Bad; 1 = Good.

| TagName | Description |
|---------|-------------|
| SysClassicManual | Storage Status of the data import service (aahManStSvc.exe). |
| SysClassicStorage | Status of the classic data redirector service (aahStoreSvc.exe). |
| SysClientAccessPoint | Status of the Client Access Point service (aahClientAccessPoint.exe). |
| SysConfiguration | Status of the configuration service (aahCfgSvc.exe). This parameter is set to 1 as long as a dynamic configuration is required or in progress. |
| SysDataAcqN* | Status of the IDAS service (aahIDASSvc.exe). |
| SysEventStorage | Status of the event storage service (aahEventStorage.exe). |
| SysEventSystem | Status of the classic event system service (aahEventSvc.exe). |
| SysIndexing | Status of the indexing service (aahIndexSvc.exe). |
| SysInSQLIOS | Status of the AVEVA Historian I/O Server (aahIOSvrSvc.exe). |
| SysMetadataServer | Status of the metadata server process (aahMetadataServer.exe) |
| SysOLEDB | Status of the OLE DB provider (loaded by SQL Server). |
| SysPulse | Discrete "pulse" tag that changes every minute. |
| SysReplication | Status of Replication service (aahReplSvc.exe). |
| SysRetrieval | Status of the retrieval service (aahRetSvc.exe). |
| SysStatusSFDataPending | Discrete tag indicating if one or more HCAL clients have store-and-forward data that needs to be sent to the Historian. NULL = Unknown; 0 = No store-and-forward data; 1 =At least one HCAL client has data. |
| SysStorage | Status of the storage process (aahStorage.exe). |
| SysSystemDriver | Status of the system driver (aahDrvSvc.exe). |
| SysStatusMode | Analog tag indicating the operational state of the Historian. If the value is NULL, the Historian is stopped. 0 = Read-only mode. 1 = Read/write mode. |

*This status tag will exist for each defined IDAS. The identifying number (N) appended to the end of the tag is the IODriverKey from the IODriver table.

## Miscellaneous (other) tags
HMI and SCADASystem PlatformHistorian 2023 R2 SP1 P03
The following table describes miscellaneous tags.

| TagName | Description |
|---------|-------------|
| SysConfigStatus | Number of database items affected by a dynamic configuration (that is, the number of entries in the ConfigStatusPending table when the commit is performed). This value is cumulative and not reset until the system is completely restarted. |
| SysHistoryCacheFaults | The number of history blocks loaded from disk per minute. The maximum value is 1,000. The storage rate for this analog tag is 60 seconds. For more information on the history cache, see Memory management for retrieval of classic storage data. |
| SysHistoryCacheUsed | Number of bytes used for history block information. The maximum value is 3,000,000,000. The storage rate for this analog tag is 30 seconds. |
| SysHistoryClients | The number of clients that are connected to the Indexing service. The maximum value is 200. The storage rate for this analog tag is 30 seconds. |
| SysMinutesRun | Minutes since the last startup. The storage rate is 60 seconds for this analog tag. |
| SysRateDeadbandForcedValues | The total number of values that were forced to be stored as a result of using a swinging door storage deadband. This number reflects all forced values for all tags since the system was started. |
| SysString | String tag whose value changes every hour. |
| SysTagHoursQueried | A floating point value updated every minute that indicates the total number of "tag retrieval hours" queried by all client applications during that minute. For example, if a single trend queries four tags for a 15-minute period, that is "1.0 tag retrieval hours". All tags, including replication sync queue tags and non-existent tags, are counted. Unlicensed tags are not counted. |

## Classic event subsystem tags
HMI and SCADASystem PlatformHistorian 2023 R2 SP1 P03
The following table describes the Classic Event subsystem tags.

| TagName | Description |
|---------|-------------|
| SysEventCritActionQSize | Size of the critical action queue. |
| SysEventDelayedActionQSize | Number of entries in the delayed action queue. |
| SysEventNormActionQSize | Size of the normal action queue. |
| SysEventSystem | A discrete tag that indicates the status of the event system service (aahEventSvc.exe). 0 = Bad; 1 = Good. |
| SysStatusEvent | Snapshot event tag whose value changes every hour. |

## Replication subsystem tags
HMI and SCADASystem PlatformHistorian 2023 R2 SP1 P03
The Replication Service collects the following custom performance counters about its own operation, where N is a primary key of the tier-2 Historian in the Runtime database of the tier-1 Historian. These values are stored cyclically every 10 seconds.

| TagName | Description |
|---------|-------------|
| SysReplicationSummaryCalcQueueItemsTotal | Current number of summary calculations stored in the summary calculation queue of all tier-2 historians. |
| SysReplicationSummaryClientsTotal | Current number of concurrent retrieval clients performing summary calculations on the tier-1 Historian for all tier-2 historians. |
| SysReplicationSyncQueueItemsN | Current number of items stored in the synchronization queue on the tier-2 Historian of key N. |
| SysReplicationSyncQueueItemsTotal | Current number of items stored in the synchronization queue on the tier-1 for all tier-2 historians. |
| SysReplicationSyncQueueValuesPerSecN | Average synchronization queue values per second sent to the tier-2 Historian of key N. |
| SysReplicationSyncQueueValuesPerSecTotal | Average values processed by the replication synchronization queue processor for all tier-2 historians. |
| SysReplicationTotalTagsN | Total number of tags being replicated to the tier-2 Historian of key N. |
| SysReplicationTotalValuesN | Total number of values sent to the tier-2 Historian of key N since the startup of the replication service. |
| SysReplicationTotalValuesTotal | Total number of values sent to all tier-2 historians since the startup of the replication service. |
| SysReplicationValuesPerSecN | Average values per second sent to the tier-2 Historian of key N. |
| SysReplicationValuesPerSecTotal | Average values per second sent to all tier-2 historians. |

## Performance monitoring tags
HMI and SCADASystem PlatformHistorian 2023 R2 SP1 P03
You use performance monitoring tags to monitor CPU loading and other performance parameters for various AVEVA Historian processes. (All of these values map to equivalent counters that are used in the Microsoft Performance Logs and Alerts application.)

The following tags allow you to monitor the percentage CPU load for all processors:

| TagName | Description |
|---------|-------------|
| SysPerfAvailableBytes | Amount of free memory (RAM). If the amount of available memory is over 4,294,967,296, then the tag shows the remainder of the amount of memory divided by 4,294,967,296. |
| SysPerfAvailableMBytes | Amount of free memory (RAM). Use this tag to monitor systems that have a larger amount of memory. The value for this tag is the amount of available memory divided by 1 million. |
| SysPerfCPUMax | The highest CPU load of any single core, expressed as a percentage (0-100). For example, on a quad core system where the current loads for each core are 25%, 40%, 60% and 10%, this tag will be "60". |
| SysPerfCPUTotal | The overall processor load as a percentage of all cores (0-100). |
| SysPerfDiskTime | Percentage of elapsed time that the disk drive was busy servicing read or write requests. |
| SysPerfMemoryPages | Rate at which pages are read from or written to disk to resolve hard page faults. |
The remaining system tags are used to monitor performance for each Historian service or process and for the Microsoft SQL Server service. For more information on services, see AVEVA Historian processes.

There are six system performance tags per each service or process. These tags adhere to the following naming convention:
- SysPerf<service>CPU
- SysPerf<service>HandleCount
- SysPerf<service>PageFaults
- SysPerf<service>PrivateBytes
- SysPerf<service>PrivateMBytes
- SysPerf<service>ThreadCount
- SysPerf<service>VirtualBytes
- SysPerf<service>VirtualMBytes

where <service> can be any of the following:
- ClassicManualStorage
- ClassicStorage
- ClientAccessPoint
- Config
- DataAcq
- EventStorage
- EventSys
- Indexing
- InSQLIOS
- MetadataServer
- Replication
- Retrieval
- SQLServer
- Storage
- SysDrv

These tags have a cyclic storage rate of 5 seconds.

Note: The six performance tags will exist for each defined IDAS. The identifying number (N) appended to the end of the "DataAcq" portion of the tagname is the IODriverKey from the IODriver table. For example, 'SysPerfDataAcq1CPU'.

The following table describes the suffixes assigned to the names of system performance tags:

| Suffix | Description |
|--------|-------------|
| CPU | Current percentage load on the service, expressed as a percentage of total CPU load. For example, on a quad core system, if the service is using 20% of one core, 40% of another core, and 0% of the other two cores, this tag will be 15%. |
| HandleCount | Total number of handles currently open by each thread in the service. A handle is a identifier for a particular resource in the system, such as a registry key or file. |
| PageFaults | Rate, per second, at which page faults occur in the threads executing the service. A page fault will occur if a thread refers to a virtual memory page that is not in its working set in main memory. Thus, the page will not be fetched from disk if it is on the standby list (and already in main memory) or if it is being used by another process. |
| PrivateBytes | Current number of bytes allocated by the service that cannot be shared with any other processes. If the amount is over 4,294,967,296, then the tag shows the remainder of the amount divided by 4,294,967,296. |
| PrivateMBytes | Current number of Mbytes allocated by the service that cannot be shared with any other processes. |
| ThreadCount | Current number of active threads in the service. A thread executes instructions, which are the basic units of execution in a processor. |
| VirtualBytes | Current size, in bytes, of the virtual address space that is being used by the service. If the amount is over 4,294,967,296, then the tag shows the remainder of the amount divided by 4,294,967,296. |
| VirtualMBytes | Current size, in Mbytes, of the virtual address space that is being used by the service. |
Important: You need to ensure that the memory that SQL Server reserves for the AVEVA Historian is adequate for the expected load. Based on your particular environment, you may need to adjust the SQL Server MemToLeave allocation. For more information on MemToLeave, see the Microsoft documentation.