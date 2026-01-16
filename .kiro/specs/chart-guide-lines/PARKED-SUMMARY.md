# Chart Guide Lines Feature - Parked Summary

## Quick Status
- **Feature**: Interactive guide lines for trend charts
- **Status**: PARKED (non-functional)
- **Date**: January 16, 2026
- **Reason**: Persistent coordinate system alignment issues after multiple fix attempts

## What Works
✅ UI controls (add/remove buttons)  
✅ Guide line state management  
✅ Counter updates  
✅ Clear all functionality  
✅ Code compiles and builds successfully  

## What Doesn't Work
❌ Horizontal lines misaligned (shifted up ~20%)  
❌ Vertical lines don't appear at all  
❌ Scale mismatch between chart and guide lines  
❌ Dragging doesn't work correctly  
❌ Intersections not visible  

## Root Cause
The absolutely-positioned SVG overlay approach doesn't reliably align with the chart's internal coordinate system. The chart has multiple layers of padding and structure that make pixel-perfect overlay positioning extremely difficult.

## Recommended Solution
Render guide lines **inside** the chart SVG instead of as an external overlay. This eliminates all positioning issues since the guide lines would share the same coordinate system as the chart.

## Files to Review
- `.kiro/specs/chart-guide-lines/STATUS.md` - Detailed status and technical analysis
- `.kiro/specs/chart-guide-lines/requirements.md` - Original requirements
- `.kiro/specs/chart-guide-lines/design.md` - Technical design
- `GUIDE-LINES-FIX.md` - Latest fix attempt documentation

## How to Resume
1. Read STATUS.md for full technical details
2. Consider implementing Option 1: Render inside chart SVG
3. Or investigate scale mismatch by checking browser console logs
