SELECT DateTime, TagName, Value FROM History
WHERE TagName = 'Kagome_AU.TC11_TT004_PV'
AND DateTime >= '2002-03-14 06:00'
AND DateTime <= '2002-03-14 18:00'
AND wwRetrievalMode = 'Dealta'