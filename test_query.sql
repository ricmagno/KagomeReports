SELECT DateTime, TagName, Value, Quality FROM History
WHERE TagName = 'Kagome_AU.NV11_TT012_PV'
AND DateTime <= GETDATE()
AND DateTime >= GETDATE() - '00:10:00'
AND wwRetrievalMode = 'Cyclic'