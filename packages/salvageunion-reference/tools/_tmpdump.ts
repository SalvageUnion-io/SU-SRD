import { loadAllDataFiles } from './loadData.js'
import { auditParity, PARITY_EXEMPTIONS } from './validateParityLogic.js'
const bag = loadAllDataFiles()
const f = auditParity(bag as never)
for (const x of f)
  console.log(
    `${x.encoded ? 'ENC' : x.exempt ? 'EX ' : 'UNR'} | ${x.schema} | ${x.record} [${x.klass}] :: ${x.sentence.slice(0, 100)}`
  )
console.log('---dead exemptions---')
for (const n of Object.keys(PARITY_EXEMPTIONS))
  if (!f.some((x) => x.record === n)) console.log('DEAD:', n)
