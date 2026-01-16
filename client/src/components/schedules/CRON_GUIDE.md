# Cron Expression User Guide

## What is a Cron Expression?

A cron expression is a string that defines when a scheduled task should run. It consists of five fields separated by spaces, each representing a different time unit.

## Cron Expression Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of Week (0-7, where 0 and 7 are Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of Month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

## Special Characters

- **`*` (Asterisk)**: Matches any value (wildcard)
  - Example: `* * * * *` means "every minute"

- **`*/n` (Step Values)**: Matches every nth value
  - Example: `*/15 * * * *` means "every 15 minutes"
  - Example: `0 */6 * * *` means "every 6 hours"

- **`n-m` (Range)**: Matches values from n to m
  - Example: `0 9-17 * * *` means "every hour from 9 AM to 5 PM"

- **`n,m,o` (List)**: Matches specific values
  - Example: `0 9,12,15 * * *` means "at 9 AM, 12 PM, and 3 PM"

## Common Examples

### Hourly Schedules

| Expression | Description |
|------------|-------------|
| `0 * * * *` | Every hour at minute 0 (e.g., 1:00, 2:00, 3:00) |
| `30 * * * *` | Every hour at minute 30 (e.g., 1:30, 2:30, 3:30) |
| `*/15 * * * *` | Every 15 minutes |

### Multi-Hour Schedules

| Expression | Description |
|------------|-------------|
| `0 */6 * * *` | Every 6 hours (12 AM, 6 AM, 12 PM, 6 PM) |
| `0 */8 * * *` | Every 8 hours (12 AM, 8 AM, 4 PM) |
| `0 */12 * * *` | Every 12 hours (12 AM, 12 PM) |

### Daily Schedules

| Expression | Description |
|------------|-------------|
| `0 9 * * *` | Every day at 9:00 AM |
| `30 14 * * *` | Every day at 2:30 PM |
| `0 0 * * *` | Every day at midnight |
| `0 6,18 * * *` | Every day at 6:00 AM and 6:00 PM |

### Weekly Schedules

| Expression | Description |
|------------|-------------|
| `0 9 * * 1` | Every Monday at 9:00 AM |
| `0 9 * * 5` | Every Friday at 9:00 AM |
| `0 9 * * 1-5` | Every weekday (Mon-Fri) at 9:00 AM |
| `0 9 * * 0,6` | Every weekend (Sat-Sun) at 9:00 AM |

**Day of Week Values:**
- 0 or 7 = Sunday
- 1 = Monday
- 2 = Tuesday
- 3 = Wednesday
- 4 = Thursday
- 5 = Friday
- 6 = Saturday

### Monthly Schedules

| Expression | Description |
|------------|-------------|
| `0 9 1 * *` | First day of every month at 9:00 AM |
| `0 9 15 * *` | 15th day of every month at 9:00 AM |
| `0 9 L * *` | Last day of every month at 9:00 AM (not supported in all systems) |
| `0 9 1 1,7 *` | First day of January and July at 9:00 AM |

## Building Your Own Cron Expression

### Step 1: Determine the Minute
- Use `0` for the top of the hour
- Use a specific number (0-59) for a specific minute
- Use `*/n` for every n minutes

### Step 2: Determine the Hour
- Use `*` for every hour
- Use a specific number (0-23) for a specific hour (0 = midnight, 12 = noon)
- Use `*/n` for every n hours

### Step 3: Determine the Day of Month
- Use `*` for every day
- Use a specific number (1-31) for a specific day

### Step 4: Determine the Month
- Use `*` for every month
- Use a specific number (1-12) for a specific month

### Step 5: Determine the Day of Week
- Use `*` for every day of the week
- Use a specific number (0-7) for a specific day

## Examples with Explanations

### Example 1: Daily Report at 9 AM
```
0 9 * * *
```
- Minute: `0` (at the top of the hour)
- Hour: `9` (9 AM)
- Day of Month: `*` (every day)
- Month: `*` (every month)
- Day of Week: `*` (every day of the week)

### Example 2: Every 6 Hours
```
0 */6 * * *
```
- Minute: `0` (at the top of the hour)
- Hour: `*/6` (every 6 hours: 12 AM, 6 AM, 12 PM, 6 PM)
- Day of Month: `*` (every day)
- Month: `*` (every month)
- Day of Week: `*` (every day of the week)

### Example 3: Weekly on Monday at 9 AM
```
0 9 * * 1
```
- Minute: `0` (at the top of the hour)
- Hour: `9` (9 AM)
- Day of Month: `*` (every day)
- Month: `*` (every month)
- Day of Week: `1` (Monday only)

### Example 4: First of Month at 9 AM
```
0 9 1 * *
```
- Minute: `0` (at the top of the hour)
- Hour: `9` (9 AM)
- Day of Month: `1` (first day of the month)
- Month: `*` (every month)
- Day of Week: `*` (any day of the week)

### Example 5: Weekdays at 8 AM and 5 PM
```
0 8,17 * * 1-5
```
- Minute: `0` (at the top of the hour)
- Hour: `8,17` (8 AM and 5 PM)
- Day of Month: `*` (every day)
- Month: `*` (every month)
- Day of Week: `1-5` (Monday through Friday)

## Tips and Best Practices

### 1. Start with Presets
Use the preset buttons in the Cron Builder for common schedules:
- Hourly
- Every 6 Hours
- Every 8 Hours
- Every 12 Hours
- Daily
- Weekly
- Monthly

### 2. Test Your Expression
After creating a cron expression, check the "Next 5 Scheduled Runs" preview to verify it matches your expectations.

### 3. Consider Time Zones
All cron expressions run in the server's timezone (typically UTC). Make sure to account for timezone differences when scheduling reports.

### 4. Avoid Overlapping Executions
If a report takes a long time to generate, avoid scheduling it too frequently. For example, if a report takes 30 minutes to generate, don't schedule it every 15 minutes.

### 5. Use Descriptive Schedule Names
Give your schedules clear names that indicate when they run and what they generate:
- ✅ "Daily Production Report - 9 AM"
- ✅ "Weekly Summary - Monday Morning"
- ❌ "Report 1"
- ❌ "Schedule"

### 6. Monitor Execution History
Regularly check the execution history to ensure your schedules are running successfully and adjust the timing if needed.

## Common Mistakes to Avoid

### Mistake 1: Confusing 12-Hour and 24-Hour Time
❌ `0 9 * * *` for 9 PM (this is 9 AM)
✅ `0 21 * * *` for 9 PM

### Mistake 2: Using Day of Month and Day of Week Together
When both day of month and day of week are specified (not `*`), the schedule runs when EITHER condition is met, not both.

Example: `0 9 15 * 1` runs on:
- The 15th of every month
- Every Monday

This is usually not what you want. Use `*` for one of them.

### Mistake 3: Forgetting About Months with Fewer Days
If you schedule something for day 31, it won't run in months with only 30 days (April, June, September, November) or February.

### Mistake 4: Not Accounting for Daylight Saving Time
During DST transitions, schedules may run at unexpected times. Consider using UTC-based scheduling for consistency.

## Validation

The Cron Builder automatically validates your expression and shows:
- ✅ Green indicator for valid expressions
- ❌ Red indicator with error message for invalid expressions
- 📅 Preview of next 5 run times for valid expressions

## Need Help?

If you're unsure about your cron expression:
1. Start with a preset that's close to what you need
2. Check the human-readable description
3. Verify the next run times preview
4. Test with a short interval first, then adjust

## Additional Resources

- [Crontab Guru](https://crontab.guru/) - Interactive cron expression editor
- [Cron Expression Generator](https://www.freeformatter.com/cron-expression-generator-quartz.html) - Visual cron builder
- [Wikipedia: Cron](https://en.wikipedia.org/wiki/Cron) - Detailed cron documentation

## Quick Reference Card

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, 0 and 7 = Sunday)
│ │ │ │ │
│ │ │ │ │
* * * * *

Special Characters:
* = any value
, = value list separator
- = range of values
/ = step values

Common Patterns:
0 * * * *     = Every hour
*/15 * * * *  = Every 15 minutes
0 */6 * * *   = Every 6 hours
0 9 * * *     = Daily at 9 AM
0 9 * * 1     = Weekly on Monday at 9 AM
0 9 1 * *     = Monthly on 1st at 9 AM
0 9 * * 1-5   = Weekdays at 9 AM
```
