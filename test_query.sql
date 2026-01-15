SELECT DateTime, TagName, Value, Quality FROM History
WHERE TagName = 'Kagome_AU.TC11_TT004_PV'
AND DateTime >= '2026-01-15 16:22:40'
AND DateTime <= '2026-01-15 16:22:41'
AND wwRetrievalMode = 'AVG'