/**
 * Test script to verify schedule update functionality
 */

import { schedulerService } from '../src/services/schedulerService';

async function testScheduleUpdate() {
  console.log('Testing schedule update functionality...\n');

  try {
    // Get all schedules
    const schedules = await schedulerService.getSchedules();
    console.log(`Found ${schedules.length} schedule(s)`);

    if (schedules.length === 0) {
      console.log('No schedules found. Creating a test schedule...');
      
      const scheduleId = await schedulerService.createSchedule({
        name: 'Test Schedule',
        description: 'Initial description',
        reportConfig: {
          id: 'test-report-1',
          name: 'Test Report',
          tags: ['tag1', 'tag2'],
          timeRange: {
            startTime: new Date('2024-01-01'),
            endTime: new Date('2024-01-02')
          },
          chartTypes: ['line'],
          template: 'default',
          format: 'pdf'
        },
        cronExpression: '0 9 * * *',
        enabled: true,
        recipients: ['test@example.com']
      });
      
      console.log(`Created schedule: ${scheduleId}\n`);
      
      // Fetch the created schedule
      const schedule = await schedulerService.getSchedule(scheduleId);
      console.log('Created schedule:', JSON.stringify(schedule, null, 2));
      
      // Test update
      console.log('\nUpdating schedule...');
      await schedulerService.updateSchedule(scheduleId, {
        name: 'Updated Test Schedule',
        description: 'Updated description',
        enabled: false
      });
      
      // Fetch updated schedule
      const updatedSchedule = await schedulerService.getSchedule(scheduleId);
      console.log('\nUpdated schedule:', JSON.stringify(updatedSchedule, null, 2));
      
      // Verify changes
      if (updatedSchedule?.name === 'Updated Test Schedule' && 
          updatedSchedule?.description === 'Updated description' &&
          updatedSchedule?.enabled === false) {
        console.log('\n✅ Update test PASSED - All fields updated correctly');
      } else {
        console.log('\n❌ Update test FAILED - Fields not updated correctly');
        console.log('Expected: name="Updated Test Schedule", description="Updated description", enabled=false');
        console.log(`Got: name="${updatedSchedule?.name}", description="${updatedSchedule?.description}", enabled=${updatedSchedule?.enabled}`);
      }
      
    } else {
      const schedule = schedules[0];
      console.log(`\nTesting with existing schedule: ${schedule.id}`);
      console.log('Current state:', JSON.stringify(schedule, null, 2));
      
      // Test update
      console.log('\nUpdating schedule...');
      const newName = `Updated at ${new Date().toISOString()}`;
      const newDescription = `Updated description at ${new Date().toISOString()}`;
      
      await schedulerService.updateSchedule(schedule.id, {
        name: newName,
        description: newDescription
      });
      
      // Fetch updated schedule
      const updatedSchedule = await schedulerService.getSchedule(schedule.id);
      console.log('\nUpdated schedule:', JSON.stringify(updatedSchedule, null, 2));
      
      // Verify changes
      if (updatedSchedule?.name === newName && updatedSchedule?.description === newDescription) {
        console.log('\n✅ Update test PASSED - All fields updated correctly');
      } else {
        console.log('\n❌ Update test FAILED - Fields not updated correctly');
        console.log(`Expected: name="${newName}", description="${newDescription}"`);
        console.log(`Got: name="${updatedSchedule?.name}", description="${updatedSchedule?.description}"`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    schedulerService.shutdown();
  }
}

testScheduleUpdate();
