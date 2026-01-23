# Report Configuration Export/Import User Guide

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Exporting Configurations](#exporting-configurations)
4. [Importing Configurations](#importing-configurations)
5. [Power BI Integration](#power-bi-integration)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)
8. [FAQ](#faq)

---

## Overview

The Export/Import feature allows you to save your report configurations to files and reload them later. This is useful for:

- **Backup**: Save configurations before making changes
- **Sharing**: Share configurations with colleagues
- **Templates**: Create reusable report templates
- **Migration**: Move configurations between environments
- **External Analysis**: Export data queries for use in Power BI

### Supported Formats

- **JSON**: Human-readable format that can be re-imported into the application
- **Power BI**: Connection file for Microsoft Power BI Desktop

---

## Getting Started

### Locating Export/Import Controls

The Export and Import buttons are located in the **Report Configuration** section of the dashboard:

1. Navigate to the main dashboard
2. Look for the Report Configuration panel
3. Find the Export (⬇️ Download) and Import (⬆️ Upload) buttons in the header

![Export/Import Buttons Location](./screenshots/export-import-buttons.png)

### Prerequisites

- You must have a report configuration created or loaded
- For imports, you need a previously exported JSON file
- For Power BI exports, you'll need Power BI Desktop installed

---

## Exporting Configurations

### Step-by-Step: Export to JSON

1. **Configure Your Report**
   - Select tags you want to include
   - Set the time range
   - Configure analytics options (trend lines, SPC metrics, statistics)
   - Set specification limits if needed

2. **Click the Export Button**
   - Click the Export button (⬇️ Download icon)
   - A format selection dialog will appear

3. **Select JSON Format**
   - Choose "JSON" from the format options
   - Read the description: "Friendly format for backup and sharing. Can be re-imported into this application."
   - Click "Export"

4. **Save the File**
   - Your browser will download a file named like: `ReportConfig_Temperature_20240115_143022.json`
   - Save it to a location you'll remember

![Format Selection Dialog](./screenshots/format-selection-dialog.png)

### Step-by-Step: Export to Power BI

1. **Configure Your Report**
   - Follow the same steps as JSON export

2. **Click the Export Button**
   - Click the Export button (⬇️ Download icon)

3. **Select Power BI Format**
   - Choose "Power BI" from the format options
   - Read the description: "Connection file for Microsoft Power BI. Enables independent data analysis."
   - Click "Export"

4. **Save the File**
   - Your browser will download a `.pq` file (Power Query file)
   - Save it for use in Power BI Desktop

### What Gets Exported?

**Included in Exports**:
- ✅ Selected tag names
- ✅ Time range settings
- ✅ Sampling mode and interval
- ✅ Analytics options (trend lines, SPC, statistics)
- ✅ Specification limits
- ✅ Report name and description
- ✅ Database server and database name (metadata only)
- ✅ Export timestamp and version information

**NOT Included in Exports** (for security):
- ❌ Database passwords
- ❌ SMTP credentials
- ❌ User passwords
- ❌ API keys or tokens

### File Naming Convention

Exported files follow this pattern:
- **JSON**: `ReportConfig_<TagNames>_<Timestamp>.json`
- **Power BI**: `PowerBI_<TagNames>_<Timestamp>.pq`

Examples:
- Single tag: `ReportConfig_Temperature_20240115_143022.json`
- Multiple tags: `ReportConfig_Temp_Press_Flow_20240115_143022.json`
- Many tags (>3): `ReportConfig_5Tags_20240115_143022.json`

---

## Importing Configurations

### Step-by-Step: Import from JSON

1. **Click the Import Button**
   - Click the Import button (⬆️ Upload icon)
   - A file browser dialog will appear

2. **Select Your JSON File**
   - Navigate to your saved configuration file
   - Select the `.json` file
   - Click "Open"

3. **Review Import Results**
   - If successful, you'll see a success message
   - The form will populate with the imported configuration
   - Review all fields before generating a report

4. **Handle Warnings (if any)**
   - If tags don't exist in the database, you'll see warnings
   - The import will still succeed, but those tags won't return data
   - You can remove non-existent tags or proceed anyway

![Successful Import](./screenshots/import-success.png)

### Handling Import Errors

If the import fails, you'll see a validation error dialog with specific issues:

**Common Errors**:

1. **Invalid JSON Format**
   - **Cause**: File is corrupted or not valid JSON
   - **Solution**: Re-export the configuration or check file integrity

2. **Missing Required Fields**
   - **Cause**: Configuration is incomplete
   - **Solution**: Check the error message for which fields are missing

3. **Invalid Time Range**
   - **Cause**: Start time is after end time, or dates are in the future
   - **Solution**: Edit the JSON file to correct the time range

4. **Schema Version Mismatch**
   - **Cause**: Configuration was exported from a different application version
   - **Solution**: The application will attempt to migrate automatically

5. **File Too Large**
   - **Cause**: File exceeds 10 MB limit
   - **Solution**: Reduce the number of tags or simplify the configuration

![Validation Error Dialog](./screenshots/validation-error-dialog.png)

### What Happens After Import?

1. **Form Population**: All form fields are filled with imported values
2. **Validation**: The configuration is validated against current database
3. **Warnings**: Non-existent tags generate warnings (not errors)
4. **Review**: You can modify the configuration before generating a report
5. **Unsaved Changes**: The form is marked as modified (unsaved)

---

## Power BI Integration

### Using Exported Power BI Files

Power BI exports allow you to analyze AVEVA Historian data directly in Power BI Desktop without running this application.

### Step-by-Step: Import into Power BI Desktop

1. **Export Configuration to Power BI Format**
   - Follow the Power BI export steps above
   - Save the `.pq` file

2. **Open Power BI Desktop**
   - Launch Microsoft Power BI Desktop

3. **Create a Blank Query**
   - Click "Get Data" → "Blank Query"
   - Or use "Transform Data" → "New Source" → "Blank Query"

4. **Open Advanced Editor**
   - In the Power Query Editor, click "Advanced Editor"

5. **Paste the M Query Code**
   - Open your exported `.pq` file in a text editor
   - Copy all the content
   - Paste it into the Advanced Editor
   - Click "Done"

6. **Configure Database Credentials**
   - Power BI will prompt for database credentials
   - Enter your AVEVA Historian database username and password
   - Choose authentication method (Windows or Database)
   - Click "Connect"

7. **Load Data**
   - Review the data preview
   - Click "Close & Apply" to load data into Power BI

![Power BI Import Process](./screenshots/powerbi-import.png)

### Understanding the Power BI Query

The exported Power Query file contains:

- **Connection Parameters**: Server address, database name
- **Tag Selection**: SQL WHERE clause with your selected tags
- **Time Range**: Date filters matching your configuration
- **Quality Filtering**: Only "Good" quality data (QualityCode = 192)
- **Data Transformation**: Type conversions for proper data types

### Modifying Power BI Queries

You can edit the M Query code to:

- Change the time range
- Add or remove tags
- Modify quality code filtering
- Add custom calculations

**Example: Change Time Range**
```m
// Find these lines in the query:
StartTime = #datetime(2024, 1, 1, 0, 0, 0),
EndTime = #datetime(2024, 1, 2, 0, 0, 0),

// Modify to your desired dates:
StartTime = #datetime(2024, 2, 1, 0, 0, 0),
EndTime = #datetime(2024, 2, 28, 23, 59, 59),
```

### Data Validation

The data retrieved through Power BI should match the data from this application:

- Same tag values (within floating-point precision)
- Same quality code filtering
- Same time range coverage
- Same SQL query structure

---

## Troubleshooting

### Export Issues

#### Problem: Export button is disabled
**Solution**: 
- Ensure you have a valid configuration loaded
- Check that all required fields are filled
- Verify you're logged in

#### Problem: Export fails with "Configuration too large"
**Solution**:
- Reduce the number of tags
- Shorten the time range
- Remove unnecessary custom settings
- Maximum export size is 5 MB

#### Problem: Downloaded file is empty or corrupted
**Solution**:
- Check your browser's download settings
- Try a different browser
- Ensure you have write permissions to the download folder

### Import Issues

#### Problem: "Invalid JSON file format" error
**Solution**:
- Verify the file is a valid JSON file
- Open the file in a text editor to check for corruption
- Re-export the configuration if needed
- Don't manually edit JSON files unless you're familiar with JSON syntax

#### Problem: "Tag not found" warnings
**Solution**:
- These are warnings, not errors - import will still succeed
- The tags may have been renamed or deleted in the database
- Remove non-existent tags from the configuration
- Or keep them if you plan to recreate those tags

#### Problem: "Schema version mismatch" error
**Solution**:
- The application will attempt automatic migration
- If migration fails, you may need to manually update the JSON
- Contact support if you need help with version migration

#### Problem: Import succeeds but form doesn't populate
**Solution**:
- Refresh the page and try again
- Check browser console for JavaScript errors
- Clear browser cache
- Try a different browser

### Power BI Issues

#### Problem: Power BI can't connect to database
**Solution**:
- Verify database credentials are correct
- Check network connectivity to the AVEVA Historian server
- Ensure firewall allows Power BI to connect
- Try Windows Authentication if Database Authentication fails

#### Problem: Power BI query returns no data
**Solution**:
- Check the time range in the M Query code
- Verify tag names are correct
- Check quality code filtering (may be too restrictive)
- Ensure tags have data in the specified time range

#### Problem: "Formula.Firewall" error in Power BI
**Solution**:
- Go to File → Options → Privacy
- Set "Privacy Levels" to "Ignore Privacy Levels"
- Click OK and refresh the query

---

## Best Practices

### Exporting

1. **Use Descriptive Names**: Edit the report name before exporting for easier identification
2. **Regular Backups**: Export configurations regularly, especially before major changes
3. **Version Control**: Include dates in filenames or use a version control system
4. **Test Exports**: Verify exports by re-importing them immediately
5. **Document Changes**: Add descriptions to configurations explaining their purpose

### Importing

1. **Review Before Use**: Always review imported configurations before generating reports
2. **Check Warnings**: Pay attention to tag validation warnings
3. **Verify Time Ranges**: Ensure time ranges are appropriate for your needs
4. **Test with Small Datasets**: Test imported configurations with short time ranges first
5. **Keep Originals**: Don't delete original export files after importing

### Security

1. **Protect Export Files**: Treat exported files as sensitive data
2. **Don't Share Credentials**: Never add credentials to export files manually
3. **Use Secure Channels**: Share configurations through secure channels only
4. **Audit Trail**: Keep track of who exports and imports configurations
5. **Regular Cleanup**: Delete old export files you no longer need

### Power BI

1. **Secure Credentials**: Use Windows Authentication when possible
2. **Refresh Schedules**: Set up automatic refresh schedules in Power BI Service
3. **Data Limits**: Be mindful of data volume when setting time ranges
4. **Query Optimization**: Optimize M Query code for better performance
5. **Documentation**: Document any modifications to exported queries

---

## FAQ

### General Questions

**Q: Can I edit exported JSON files manually?**
A: Yes, but be careful. Invalid JSON will fail to import. Use a JSON validator before importing edited files.

**Q: Are exports compatible across different versions of the application?**
A: The application attempts to migrate older schema versions automatically. Major version changes may require manual updates.

**Q: Can I export multiple configurations at once?**
A: No, you must export configurations one at a time.

**Q: How long are exported files valid?**
A: Indefinitely, as long as the schema version is supported. However, tag names may change over time.

### Format Questions

**Q: Which format should I use?**
A: Use JSON for backup and sharing within the application. Use Power BI for external data analysis.

**Q: Can I convert Power BI exports back to JSON?**
A: No, Power BI exports are one-way. They cannot be re-imported into the application.

**Q: Why are credentials not included in exports?**
A: For security. Credentials should never be stored in files or shared.

### Import Questions

**Q: What happens to my current configuration when I import?**
A: It's replaced with the imported configuration. The form is marked as modified (unsaved).

**Q: Can I undo an import?**
A: Yes, refresh the page before saving to discard the imported configuration.

**Q: Why do I see warnings about non-existent tags?**
A: Tags in the export may have been deleted or renamed. The import succeeds, but those tags won't return data.

### Power BI Questions

**Q: Do I need this application running to use Power BI exports?**
A: No, Power BI connects directly to the AVEVA Historian database.

**Q: Can I schedule automatic refreshes in Power BI?**
A: Yes, publish to Power BI Service and configure refresh schedules.

**Q: Why is my Power BI query slow?**
A: Large time ranges or many tags can slow queries. Optimize by reducing scope or adding filters.

---

## Support

If you encounter issues not covered in this guide:

1. Check the API documentation for technical details
2. Review error messages carefully - they often contain specific guidance
3. Check application logs for detailed error information
4. Contact your system administrator
5. Reach out to support with:
   - Error messages and codes
   - Steps to reproduce the issue
   - Export file (if relevant and safe to share)
   - Application version

---

## Appendix: File Format Specifications

### JSON Export Structure

```json
{
  "schemaVersion": "1.0",
  "exportMetadata": {
    "exportDate": "ISO 8601 timestamp",
    "exportedBy": "user identifier",
    "applicationVersion": "version string",
    "platform": "operating system"
  },
  "reportConfig": {
    "tags": ["array", "of", "tag", "names"],
    "timeRange": {
      "startTime": "ISO 8601 timestamp",
      "endTime": "ISO 8601 timestamp"
    },
    "sampling": {
      "mode": "Cyclic | Delta | BestFit",
      "interval": 60
    },
    "analytics": {
      "enabled": true,
      "showTrendLine": true,
      "showSPCMetrics": true,
      "showStatistics": true
    },
    "specificationLimits": {
      "enabled": true,
      "upperLimit": 100,
      "lowerLimit": 0,
      "target": 50
    },
    "reportName": "string",
    "description": "string"
  },
  "securityNotice": "Credentials must be configured separately"
}
```

### Power BI Export Structure

Power BI exports use the M Query language (Power Query Formula Language):

```m
let
    // Configuration section
    Config = [
        Server = "server.address",
        Database = "database_name",
        Tags = {"Tag1", "Tag2"},
        StartTime = #datetime(2024, 1, 1, 0, 0, 0),
        EndTime = #datetime(2024, 1, 2, 0, 0, 0)
    ],
    
    // SQL query generation
    SqlQuery = "SELECT ... FROM History ...",
    
    // Data retrieval
    Source = Sql.Database(Config[Server], Config[Database], [Query=SqlQuery])
in
    Source
```

---

**Document Version**: 1.0  
**Last Updated**: January 2024  
**Application Version**: 1.0.0
