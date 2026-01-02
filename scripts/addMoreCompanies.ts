import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

function slugify(name: string): string {
  return name.toLowerCase().replace(/&/g, '-and-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const MORE_COMPANIES = [
  // More AI/ML
  { name: 'Anthropic', ats: 'https://boards.greenhouse.io/anthropic' },
  { name: 'xAI', ats: 'https://boards.greenhouse.io/xai' },
  { name: 'Mistral AI', ats: 'https://jobs.lever.co/mistral' },
  { name: 'Covariant', ats: 'https://boards.greenhouse.io/covariant' },
  { name: 'Figure', ats: 'https://boards.greenhouse.io/figure' },
  { name: 'Boston Dynamics', ats: 'https://boards.greenhouse.io/bostondynamics' },
  { name: 'Nuro', ats: 'https://boards.greenhouse.io/nuro' },
  { name: 'Waymo', ats: 'https://boards.greenhouse.io/waymo' },
  { name: 'Cruise', ats: 'https://boards.greenhouse.io/cruise' },
  { name: 'Aurora', ats: 'https://boards.greenhouse.io/aurora' },
  { name: 'Zoox', ats: 'https://boards.greenhouse.io/zoox' },
  { name: 'Argo AI', ats: 'https://boards.greenhouse.io/argoai' },
  { name: 'Embark', ats: 'https://boards.greenhouse.io/embark' },
  { name: 'TuSimple', ats: 'https://boards.greenhouse.io/tusimple' },
  { name: 'Kodiak', ats: 'https://boards.greenhouse.io/kodiak' },
  { name: 'Gatik', ats: 'https://boards.greenhouse.io/gatik' },
  { name: 'Einride', ats: 'https://boards.greenhouse.io/einride' },
  { name: 'Plus', ats: 'https://boards.greenhouse.io/plus' },
  { name: 'Torc', ats: 'https://boards.greenhouse.io/torc' },
  { name: 'Stack AV', ats: 'https://boards.greenhouse.io/stackav' },
  // More SaaS
  { name: 'Zoom', ats: 'https://boards.greenhouse.io/zoom' },
  { name: 'Webex', ats: 'https://boards.greenhouse.io/webex' },
  { name: 'RingCentral', ats: 'https://boards.greenhouse.io/ringcentral' },
  { name: 'Dialpad', ats: 'https://boards.greenhouse.io/dialpad' },
  { name: 'Aircall', ats: 'https://boards.greenhouse.io/aircall' },
  { name: 'Talkdesk', ats: 'https://boards.greenhouse.io/talkdesk' },
  { name: 'Five9', ats: 'https://boards.greenhouse.io/five9' },
  { name: 'Genesys', ats: 'https://boards.greenhouse.io/genesys' },
  { name: 'Nice', ats: 'https://boards.greenhouse.io/nice' },
  { name: 'Twilio Flex', ats: 'https://boards.greenhouse.io/twiloflex' },
  { name: 'Vonage', ats: 'https://boards.greenhouse.io/vonage' },
  { name: 'Bandwidth', ats: 'https://boards.greenhouse.io/bandwidth' },
  { name: 'Plivo', ats: 'https://boards.greenhouse.io/plivo' },
  { name: 'Sinch', ats: 'https://boards.greenhouse.io/sinch' },
  { name: 'Infobip', ats: 'https://boards.greenhouse.io/infobip' },
  // More B2B
  { name: 'Salesforce', ats: 'https://boards.greenhouse.io/salesforce' },
  { name: 'ServiceNow', ats: 'https://boards.greenhouse.io/servicenow' },
  { name: 'Workday', ats: 'https://boards.greenhouse.io/workday' },
  { name: 'SAP', ats: 'https://boards.greenhouse.io/sap' },
  { name: 'Oracle', ats: 'https://boards.greenhouse.io/oracle' },
  { name: 'Adobe', ats: 'https://boards.greenhouse.io/adobe' },
  { name: 'Autodesk', ats: 'https://boards.greenhouse.io/autodesk' },
  { name: 'Intuit', ats: 'https://boards.greenhouse.io/intuit' },
  { name: 'Splunk', ats: 'https://boards.greenhouse.io/splunk' },
  { name: 'Elastic', ats: 'https://boards.greenhouse.io/elastic' },
  { name: 'MongoDB', ats: 'https://boards.greenhouse.io/mongodb' },
  { name: 'Redis', ats: 'https://boards.greenhouse.io/redis' },
  { name: 'Neo4j', ats: 'https://boards.greenhouse.io/neo4j' },
  { name: 'Couchbase', ats: 'https://boards.greenhouse.io/couchbase' },
  { name: 'InfluxData', ats: 'https://boards.greenhouse.io/influxdata' },
  { name: 'QuestDB', ats: 'https://boards.greenhouse.io/questdb' },
  { name: 'MinIO', ats: 'https://boards.greenhouse.io/minio' },
  { name: 'Wasabi', ats: 'https://boards.greenhouse.io/wasabi' },
  { name: 'Backblaze', ats: 'https://boards.greenhouse.io/backblaze' },
  { name: 'Storj', ats: 'https://boards.greenhouse.io/storj' },
  // More Fintech
  { name: 'Revolut', ats: 'https://boards.greenhouse.io/revolut' },
  { name: 'Monzo', ats: 'https://boards.greenhouse.io/monzo' },
  { name: 'N26', ats: 'https://boards.greenhouse.io/n26' },
  { name: 'Nubank', ats: 'https://boards.greenhouse.io/nubank' },
  { name: 'SoFi', ats: 'https://boards.greenhouse.io/sofi' },
  { name: 'Public', ats: 'https://boards.greenhouse.io/public' },
  { name: 'Titan', ats: 'https://boards.greenhouse.io/titan' },
  { name: 'M1 Finance', ats: 'https://boards.greenhouse.io/m1finance' },
  { name: 'Alpaca', ats: 'https://boards.greenhouse.io/alpaca' },
  { name: 'DriveWealth', ats: 'https://boards.greenhouse.io/drivewealth' },
  { name: 'Apex', ats: 'https://boards.greenhouse.io/apex' },
  { name: 'Tradier', ats: 'https://boards.greenhouse.io/tradier' },
  { name: 'Tastytrade', ats: 'https://boards.greenhouse.io/tastytrade' },
  { name: 'Webull', ats: 'https://boards.greenhouse.io/webull' },
  { name: 'eToro', ats: 'https://boards.greenhouse.io/etoro' },
  { name: 'Trading 212', ats: 'https://boards.greenhouse.io/trading212' },
  { name: 'Freetrade', ats: 'https://boards.greenhouse.io/freetrade' },
  { name: 'Stake', ats: 'https://boards.greenhouse.io/stake' },
  { name: 'Shares', ats: 'https://boards.greenhouse.io/shares' },
  { name: 'Lightyear', ats: 'https://boards.greenhouse.io/lightyear' },
  // More Crypto
  { name: 'Kraken', ats: 'https://boards.greenhouse.io/kraken' },
  { name: 'Gemini', ats: 'https://boards.greenhouse.io/gemini' },
  { name: 'FTX', ats: 'https://boards.greenhouse.io/ftx' },
  { name: 'Binance', ats: 'https://boards.greenhouse.io/binance' },
  { name: 'Crypto.com', ats: 'https://boards.greenhouse.io/cryptocom' },
  { name: 'BlockFi', ats: 'https://boards.greenhouse.io/blockfi' },
  { name: 'Celsius', ats: 'https://boards.greenhouse.io/celsius' },
  { name: 'Nexo', ats: 'https://boards.greenhouse.io/nexo' },
  { name: 'Ledn', ats: 'https://boards.greenhouse.io/ledn' },
  { name: 'Abra', ats: 'https://boards.greenhouse.io/abra' },
  { name: 'Blockchain.com', ats: 'https://boards.greenhouse.io/blockchaincom' },
  { name: 'BitGo', ats: 'https://boards.greenhouse.io/bitgo' },
  { name: 'Fireblocks', ats: 'https://boards.greenhouse.io/fireblocks' },
  { name: 'Anchorage', ats: 'https://boards.greenhouse.io/anchorage' },
  { name: 'Copper', ats: 'https://boards.greenhouse.io/copper' },
  { name: 'Paxos', ats: 'https://boards.greenhouse.io/paxos' },
  { name: 'Circle', ats: 'https://boards.greenhouse.io/circle' },
  { name: 'Ripple', ats: 'https://boards.greenhouse.io/ripple' },
  { name: 'Stellar', ats: 'https://boards.greenhouse.io/stellar' },
  { name: 'Algorand', ats: 'https://boards.greenhouse.io/algorand' },
  { name: 'Solana Labs', ats: 'https://boards.greenhouse.io/solanalabs' },
  { name: 'Near', ats: 'https://boards.greenhouse.io/near' },
  { name: 'Aptos', ats: 'https://boards.greenhouse.io/aptos' },
  { name: 'Sui', ats: 'https://boards.greenhouse.io/sui' },
  { name: 'LayerZero', ats: 'https://boards.greenhouse.io/layerzero' },
  { name: 'Wormhole', ats: 'https://boards.greenhouse.io/wormhole' },
  { name: 'Axelar', ats: 'https://boards.greenhouse.io/axelar' },
  { name: 'Celer', ats: 'https://boards.greenhouse.io/celer' },
  { name: 'Synapse', ats: 'https://boards.greenhouse.io/synapse' },
  { name: 'Stargate', ats: 'https://boards.greenhouse.io/stargate' },
  // More Healthcare
  { name: 'Teladoc', ats: 'https://boards.greenhouse.io/teladoc' },
  { name: 'Amwell', ats: 'https://boards.greenhouse.io/amwell' },
  { name: 'MDLive', ats: 'https://boards.greenhouse.io/mdlive' },
  { name: 'Doctor on Demand', ats: 'https://boards.greenhouse.io/doctorondemand' },
  { name: 'PlushCare', ats: 'https://boards.greenhouse.io/plushcare' },
  { name: 'Heal', ats: 'https://boards.greenhouse.io/heal' },
  { name: 'DispatchHealth', ats: 'https://boards.greenhouse.io/dispatchhealth' },
  { name: 'Ready', ats: 'https://boards.greenhouse.io/ready' },
  { name: 'Pair Team', ats: 'https://boards.greenhouse.io/pairteam' },
  { name: 'Firefly Health', ats: 'https://boards.greenhouse.io/fireflyhealth' },
  { name: 'Devoted Health', ats: 'https://boards.greenhouse.io/devotedhealth' },
  { name: 'Bright Health', ats: 'https://boards.greenhouse.io/brighthealth' },
  { name: 'Alignment Healthcare', ats: 'https://boards.greenhouse.io/alignmenthealthcare' },
  { name: 'Aledade', ats: 'https://boards.greenhouse.io/aledade' },
  { name: 'Agilon Health', ats: 'https://boards.greenhouse.io/agilonhealth' },
  { name: 'VillageMD', ats: 'https://boards.greenhouse.io/villagemd' },
  { name: 'Oak Street Health', ats: 'https://boards.greenhouse.io/oakstreethealth' },
  { name: 'Iora Health', ats: 'https://boards.greenhouse.io/iorahealth' },
  { name: 'Chen Med', ats: 'https://boards.greenhouse.io/chenmed' },
  { name: 'Cano Health', ats: 'https://boards.greenhouse.io/canohealth' },
  // More Consumer
  { name: 'Uber', ats: 'https://boards.greenhouse.io/uber' },
  { name: 'Grab', ats: 'https://boards.greenhouse.io/grab' },
  { name: 'Gojek', ats: 'https://boards.greenhouse.io/gojek' },
  { name: 'Careem', ats: 'https://boards.greenhouse.io/careem' },
  { name: 'Bolt', ats: 'https://boards.greenhouse.io/bolt' },
  { name: 'Free Now', ats: 'https://boards.greenhouse.io/freenow' },
  { name: 'Cabify', ats: 'https://boards.greenhouse.io/cabify' },
  { name: 'BlaBlaCar', ats: 'https://boards.greenhouse.io/blablacar' },
  { name: 'Via', ats: 'https://boards.greenhouse.io/via' },
  { name: 'Moovit', ats: 'https://boards.greenhouse.io/moovit' },
  { name: 'Citymapper', ats: 'https://boards.greenhouse.io/citymapper' },
  { name: 'Transit', ats: 'https://boards.greenhouse.io/transit' },
  { name: 'Swiftly', ats: 'https://boards.greenhouse.io/swiftly' },
  { name: 'Optibus', ats: 'https://boards.greenhouse.io/optibus' },
  { name: 'Remix', ats: 'https://boards.greenhouse.io/remix' },
  // More EdTech
  { name: 'Brilliant', ats: 'https://boards.greenhouse.io/brilliant' },
  { name: 'Photomath', ats: 'https://boards.greenhouse.io/photomath' },
  { name: 'Symbolab', ats: 'https://boards.greenhouse.io/symbolab' },
  { name: 'Mathway', ats: 'https://boards.greenhouse.io/mathway' },
  { name: 'Wolfram', ats: 'https://boards.greenhouse.io/wolfram' },
  { name: 'Desmos', ats: 'https://boards.greenhouse.io/desmos' },
  { name: 'GeoGebra', ats: 'https://boards.greenhouse.io/geogebra' },
  { name: 'Expii', ats: 'https://boards.greenhouse.io/expii' },
  { name: 'Art of Problem Solving', ats: 'https://boards.greenhouse.io/aops' },
  { name: 'Beast Academy', ats: 'https://boards.greenhouse.io/beastacademy' },
  { name: 'IXL', ats: 'https://boards.greenhouse.io/ixl' },
  { name: 'DreamBox', ats: 'https://boards.greenhouse.io/dreambox' },
  { name: 'Zearn', ats: 'https://boards.greenhouse.io/zearn' },
  { name: 'ST Math', ats: 'https://boards.greenhouse.io/stmath' },
  { name: 'Prodigy', ats: 'https://boards.greenhouse.io/prodigy' },
  // More Gaming
  { name: 'Valve', ats: 'https://boards.greenhouse.io/valve' },
  { name: 'CD Projekt', ats: 'https://boards.greenhouse.io/cdprojekt' },
  { name: 'Rockstar', ats: 'https://boards.greenhouse.io/rockstar' },
  { name: 'Ubisoft', ats: 'https://boards.greenhouse.io/ubisoft' },
  { name: 'Square Enix', ats: 'https://boards.greenhouse.io/squareenix' },
  { name: 'Capcom', ats: 'https://boards.greenhouse.io/capcom' },
  { name: 'Bandai Namco', ats: 'https://boards.greenhouse.io/bandainamco' },
  { name: 'Sega', ats: 'https://boards.greenhouse.io/sega' },
  { name: 'Konami', ats: 'https://boards.greenhouse.io/konami' },
  { name: 'SNK', ats: 'https://boards.greenhouse.io/snk' },
  { name: 'Arc System Works', ats: 'https://boards.greenhouse.io/arcsystemworks' },
  { name: 'FromSoftware', ats: 'https://boards.greenhouse.io/fromsoftware' },
  { name: 'PlatinumGames', ats: 'https://boards.greenhouse.io/platinumgames' },
  { name: 'Insomniac', ats: 'https://boards.greenhouse.io/insomniac' },
  { name: 'Naughty Dog', ats: 'https://boards.greenhouse.io/naughtydog' },
  { name: 'Santa Monica', ats: 'https://boards.greenhouse.io/santamonica' },
  { name: 'Bungie', ats: 'https://boards.greenhouse.io/bungie' },
  { name: '343 Industries', ats: 'https://boards.greenhouse.io/343industries' },
  { name: 'Blizzard', ats: 'https://boards.greenhouse.io/blizzard' },
  { name: 'Respawn', ats: 'https://boards.greenhouse.io/respawn' },
  { name: 'DICE', ats: 'https://boards.greenhouse.io/dice' },
  { name: 'BioWare', ats: 'https://boards.greenhouse.io/bioware' },
  { name: 'Bethesda', ats: 'https://boards.greenhouse.io/bethesda' },
  { name: 'id Software', ats: 'https://boards.greenhouse.io/idsoftware' },
  { name: 'MachineGames', ats: 'https://boards.greenhouse.io/machinegames' },
  { name: 'Arkane', ats: 'https://boards.greenhouse.io/arkane' },
  { name: 'Obsidian', ats: 'https://boards.greenhouse.io/obsidian' },
  { name: 'Double Fine', ats: 'https://boards.greenhouse.io/doublefine' },
  { name: 'Playground Games', ats: 'https://boards.greenhouse.io/playgroundgames' },
  { name: 'Turn 10', ats: 'https://boards.greenhouse.io/turn10' },
]

async function main() {
  __slog('Adding more companies...\n')
  let added = 0, existed = 0
  
  for (const c of MORE_COMPANIES) {
    const slug = slugify(c.name)
    const existing = await prisma.company.findFirst({ where: { OR: [{ slug }, { name: c.name }] } })
    if (existing) { existed++; continue }
    
    await prisma.company.create({
      data: {
        name: c.name, slug, atsUrl: c.ats,
        logoUrl: 'https://logo.clearbit.com/' + slug.replace(/-/g, '') + '.com',
      }
    })
    added++
  }
  
  const total = await prisma.company.count()
  __slog('Existed:', existed, '| Added:', added, '| Total:', total)
  await prisma.$disconnect()
}

main()
