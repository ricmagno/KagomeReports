-- Historian Query for TC11 (Dice Line 2) Issues Analysis
-- Period: 2026-02-01 to 2026-02-21
-- Note: Using Cyclic retrieval at 1-minute resolution to capture trend data for all 131 tags.

SELECT
    TagName,
    DateTime,
    Value,
    vValue,
    Quality,
    wwRetrievalMode,
    wwResolution
FROM History
WHERE TagName LIKE 'Kagome_AU.TC11_%'
AND DateTime >= '2026-02-01 00:00:00'
AND DateTime <= '2026-02-21 00:00:00'
AND wwRetrievalMode = 'Cyclic'
AND wwResolution = 60000
ORDER BY DateTime, TagName;
