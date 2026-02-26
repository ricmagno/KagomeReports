# Background
Some time ago we develop this simple app that sends a text message to a user group when a tag is above or below certain limits.
The tag values were provided by an opc ua server.
Tag names were hard coded and the user groups were defined externally
The sms was send using an api. Api description is on the code and the API code is available with the source code.
The source code is at `/Users/ricmagno/Documents/Projects/KagomeReports/scadaSMS` NO Twilio.

# Goal
Using scadaSMS as a base, we will create a feature on KagomeReport (`/Users/ricmagno/Documents/Projects/KagomeReports`) 
The new feature will be name Alerts.

## Stage 1 - OPC UA client integration

### OPC UA client
1. We will integrate an OPC UA client that will connect to the OPC UA server.
2. The user will be able to browse, select and acquire tags values.
3. The user will be able to use selected tags on the dashboard similarly to that it is possible with the Historian data.

## Stage 2 - Alerts
### Alert lists
1. Currently there are the default users that represent groups configured on the system:
    - admin
    - Management
    - Supervisors
    - Quality
    - Maintenance
    - Operators

2. These users should be able to create alert distribution lists what will be notified via SMS and/or email. A list should contain:
    - Name
    - Phone
    - Email

### Alerts
1. The new feature will be name Alerts.
2. When a selected tag is at alarm a SMS will be sent to a defined group.
    - The tags alarms are defined on SCADA to ensure consistency. The user will be able to select a tag.PV (more about it bellow) and select what alarms he/she would like to be notified via SMS, HH, H, L, LL (also further description bellow). 
    - The Alerts configuration and display should be similar to the current dashboards (they will be integrated in the future). 
    The analog tag structure is as follows:
        - PLC_TAG (PLC is an arbitrary name of the source plc. TAG is in the format 2 or 3 letters that identify the P&ID equipment using ISA code followed by a 3 digit numbers that identify the equipment (the first digit on the left indicate the subsystem and the other two are sequential identification), e.g., NV11_FT001 means NV11 system 0 (or main system) flow transducer number 01.
            - .PV (float) process value, e.g., NV11_FT001.PV
            - .HighHigh (float) high high limit alarm value defined on SCADA, e.g., NV11_FT001.HighHigh
            - .High (float) high limit alarm value defined on SCADA, e.g., NV11_FT001.High
            - .Low (float) low limit alarm value defined on SCADA, e.g., NV11_FT001.Low
            - .LowLow (float) low low limit alarm value defined on SCADA, e.g., NV11_FT001.LowLow
            - .HH (boolean) high high alarm event (0: no alarm, 1: alarm). Explanation: The .PV is higher than .HighHigh and this alarming function is enabled (in the SCADA), e.g., NV11_FT001.HH
            - .H (boolean) high alarm event (0: no alarm, 1: alarm). Explanation: The .PV is higher than .High and this alarming function is enabled (in the SCADA), e.g., NV11_FT001.H
            - .L (boolean) low alarm event (0: no alarm, 1: alarm). Explanation: The .PV is lower than .Low and this alarming function is enabled (in the SCADA), e.g., NV11_FT001.L
            - .LL (boolean) low low alarm event (0: no alarm, 1: alarm). Explanation: The .PV is lower than .LowLow and this alarming function is enabled (in the SCADA), e.g., NV11_FT001.LL