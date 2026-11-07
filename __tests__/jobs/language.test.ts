import { detectJobLanguage, JOB_LANGUAGE_NAMES, type JobLanguage } from '../../lib/jobs/language'

const SAMPLES: Record<Exclude<JobLanguage, 'other'>, string> = {
  en: 'We are looking for a Senior Backend Engineer to join our platform team. You will design and build the services that power our payments product, work with product managers and designers, and mentor other engineers. We expect experience with distributed systems and the ability to work independently.',
  es: 'Buscamos un Ingeniero de Software Senior para unirse a nuestro equipo de plataforma. Tendrás la responsabilidad de diseñar y desarrollar los servicios que sostienen nuestro producto de pagos, trabajar con el equipo de producto y acompañar a otros ingenieros. Requisitos: más de cinco años de experiencia con sistemas distribuidos y conocimientos de bases de datos.',
  de: 'Wir suchen einen Senior Backend Engineer für unser Plattform-Team in Berlin. Ihre Aufgaben sind die Entwicklung der Dienste, die unser Zahlungsprodukt antreiben, die Zusammenarbeit mit dem Produktteam und die Betreuung von Kolleginnen und Kollegen. Sie bringen mehrjährige Erfahrung mit verteilten Systemen mit und sind es gewohnt, selbstständig zu arbeiten.',
  fr: "Nous recherchons un ingénieur logiciel senior pour rejoindre notre équipe plateforme à Paris. Vous serez chargé de concevoir et de développer les services qui font fonctionner notre produit de paiement, de travailler avec les équipes produit et d'accompagner les autres ingénieurs. Votre profil : plus de cinq ans d'expérience dans les systèmes distribués.",
  nl: 'Wij zoeken een Senior Backend Engineer voor ons platformteam in Amsterdam. Je ontwerpt en bouwt de services die ons betaalproduct aandrijven, werkt samen met het productteam en begeleidt andere engineers. Je hebt ervaring met gedistribueerde systemen en je bent gewend om zelfstandig te werken bij een groeiend bedrijf.',
  it: "Ricerchiamo un Senior Software Engineer per il nostro team di piattaforma a Milano. Sarai responsabile della progettazione e dello sviluppo dei servizi che alimentano il nostro prodotto di pagamenti, lavorerai con il team di prodotto e supporterai gli altri ingegneri. Requisiti: oltre cinque anni di esperienza con sistemi distribuiti e competenze sui database.",
  pt: 'Procuramos um Engenheiro de Software Sénior para integrar a nossa equipa de plataforma em Lisboa. Será responsável por desenhar e desenvolver os serviços que suportam o nosso produto de pagamentos, trabalhar com a equipa de produto e acompanhar outros engenheiros. Requisitos: mais de cinco anos de experiência com sistemas distribuídos e conhecimentos de bases de dados.',
  pl: 'Poszukujemy Senior Backend Engineera do naszego zespołu platformy w Warszawie. Będziesz projektować i rozwijać usługi, które napędzają nasz produkt płatniczy, współpracować z zespołem produktowym oraz wspierać innych inżynierów. Wymagania: ponad pięć lat doświadczenie w pracy z systemami rozproszonymi, a jest to dla nas ważne jako podstawa.',
  sv: 'Vi söker en Senior Backend Engineer till vårt plattformsteam i Stockholm. Du kommer att designa och bygga de tjänster som driver vår betalprodukt, arbeta med produktteamet och stötta andra utvecklare. Vi ser att du har lång erfarenhet av distribuerade system och att du trivs med att arbeta självständigt på ett växande bolag.',
  da: 'Vi søger en Senior Backend Engineer til vores platformsteam i København. Du skal designe og bygge de services, som driver vores betalingsprodukt, arbejde sammen med produktteamet og hjælpe andre udviklere. Du har lang erfaring med distribuerede systemer, og du er vant til at arbejde selvstændigt i stillingen hos os, og jeres drømmejob venter.',
  no: 'Vi søker en Senior Backend Engineer til vårt plattformteam i Oslo. Du skal designe og bygge tjenestene som driver betalingsproduktet vårt, jobbe sammen med produktteamet og støtte andre utviklere. Du har lang erfaring med distribuerte systemer, og du er vant til å jobbe selvstendig i stillingen, og vi gleder oss til å høre fra deg.',
}

describe('detectJobLanguage', () => {
  it.each(Object.keys(SAMPLES) as Array<keyof typeof SAMPLES>)('recognises %s', (code) => {
    expect(detectJobLanguage(SAMPLES[code])).toBe(code)
  })

  it('reads through HTML tags and entities', () => {
    const html = `<div><h3>Aufgaben</h3><p>${SAMPLES.de.replace('Wir suchen', 'Wir&nbsp;suchen')}</p><ul><li>Sie</li></ul></div>`
    expect(detectJobLanguage(html)).toBe('de')
  })

  it('ignores script and style content', () => {
    expect(detectJobLanguage(`<style>.a{color:red}</style><script>var el=la</script>${SAMPLES.es}`)).toBe('es')
  })

  it('stays Spanish when the text is full of English tech terms', () => {
    const text =
      'Buscamos un Staff Engineer con experiencia en Kubernetes, Terraform, AWS, GraphQL y TypeScript. Serás parte del equipo de infraestructura y trabajarás con los equipos de producto para mejorar la plataforma. Requisitos: más de seis años de experiencia en el desarrollo de backend y conocimientos de observabilidad, CI/CD y bases de datos.'
    expect(detectJobLanguage(text)).toBe('es')
  })

  it('stays English when a posting has a few foreign words', () => {
    const text =
      'Join our Madrid office as a Senior Engineer. You will work with the team on the platform that our customers rely on, and you will have the ability to shape how we build. Nice to have: Spanish (español), German (Deutsch). We offer a great package with the chance to grow, for you and for the company.'
    expect(detectJobLanguage(text)).toBe('en')
  })

  it('recognises an Italian sales posting that uses short everyday words', () => {
    const text =
      'Le informazioni principali. Territorio: Toscana, principali città e province. Attività: vendita diretta sul territorio a professionisti e piccole imprese, con appuntamenti presso i clienti. Il tuo compito è generare nuove opportunità e far crescere il portafoglio, anche attraverso relazioni nel tempo. Non è richiesta esperienza nel settore dei pagamenti, ma è importante saper lavorare per obiettivi.'
    expect(detectJobLanguage(text)).toBe('it')
  })

  it('calls a bilingual posting by its main body, not its short English intro', () => {
    const text =
      'Our Global Structure: Deliveroo is now part of DoorDash. Pour ce poste, vous serez chargé de gérer un portefeuille de partenaires et de faire des recommandations dans une logique d’excellence de service. Vous avez de l’expérience dans la vente, vous êtes à l’aise avec les chiffres et vous aimez travailler avec les équipes pour atteindre les objectifs de votre secteur. Nous vous proposons un poste dans une entreprise en mouvement.'
    expect(detectJobLanguage(text)).toBe('fr')
  })

  it('returns null for empty or too-short text rather than guessing', () => {
    expect(detectJobLanguage(null)).toBeNull()
    expect(detectJobLanguage('')).toBeNull()
    expect(detectJobLanguage('Ingeniero de software senior en Madrid')).toBeNull()
  })

  it('recognises a Portuguese sales posting', () => {
    const text =
      'Procuramos um Consultor de Vendas para trabalhar em Lisboa com clientes da nossa empresa. Será responsável por vender os nossos produtos, acompanhar os clientes e cumprir os objetivos da sua equipa. Não é necessária experiência no setor, mas valorizamos quem tem vontade de aprender e uma boa capacidade de comunicação com os clientes e com as equipas.'
    expect(detectJobLanguage(text)).toBe('pt')
  })

  it.each([
    ['Cyrillic', 'Ние търсим старши софтуерен инженер за нашия екип в София. Ще проектирате и изграждате услугите, които захранват нашия платежен продукт, ще работите с продуктовия екип и ще помагате на други инженери. Изискваме дългогодишен опит с разпределени системи.'],
    ['Greek', 'Ζητάμε έναν ανώτερο μηχανικό λογισμικού για την ομάδα της πλατφόρμας μας στην Αθήνα. Θα σχεδιάζετε και θα δημιουργείτε τις υπηρεσίες που τροφοδοτούν το προϊόν πληρωμών μας και θα συνεργάζεστε με την ομάδα προϊόντος. Απαιτείται πολυετής εμπειρία με κατανεμημένα συστήματα.'],
    ['Japanese', 'プラットフォームチームのシニアバックエンドエンジニアを募集しています。決済プロダクトを支えるサービスの設計と開発を担当し、プロダクトチームと協力しながら、他のエンジニアの育成にも携わっていただきます。分散システムに関する豊富な経験をお持ちの方を歓迎します。'],
  ])('flags %s text as "other" (a non-Latin script) instead of English', (_name, text) => {
    expect(detectJobLanguage(text)).toBe('other')
  })

  it('returns null for languages it does not know', () => {
    const finnish =
      'Etsimme senior-ohjelmistokehittäjää alustatiimiimme Helsingissä. Sinä suunnittelet ja rakennat palvelut, jotka pyörittävät maksutuotettamme, teet yhteistyötä tuotetiimin kanssa ja autat muita kehittäjiä. Sinulla on pitkä kokemus hajautetuista järjestelmistä ja olet tottunut työskentelemään itsenäisesti kasvavassa yrityksessä.'
    expect(detectJobLanguage(finnish)).toBeNull()
  })

  it('has an English name for every language it can return', () => {
    for (const code of Object.keys(SAMPLES) as JobLanguage[]) expect(JOB_LANGUAGE_NAMES[code]).toMatch(/^[A-Z][a-z]+$/)
  })
})
