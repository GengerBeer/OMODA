export type Category =
  | "world"
  | "technology"
  | "business"
  | "science"
  | "sports"
  | "culture";

export interface DemoArticle {
  id: string;
  source: string;
  title: string;
  body: string;
  imageUrl: string;
  publishedAt: string;
  category: Category;
}

export const demoArticles: DemoArticle[] = [
  {
    id: "article-001",
    source: "Signal Daily",
    title: "AI chips are reshaping the next wave of mobile devices",
    body: "Phone makers are redesigning flagship roadmaps around on-device AI workloads. New silicon designs are targeting private inference, longer battery life and faster image generation without depending on cloud round-trips. Analysts say the shift could become as important to premium devices as camera systems were in the last upgrade cycle.",
    imageUrl: "",
    publishedAt: "2026-04-03T08:00:00Z",
    category: "technology",
  },
  {
    id: "article-002",
    source: "Market Notebook",
    title: "European climate startups find momentum in industrial software",
    body: "A growing class of industrial software startups is attracting capital by helping manufacturers track emissions, model energy use and automate compliance reporting. Investors say the next wave of climate technology may be less about hardware and more about operational software embedded inside factories.",
    imageUrl: "",
    publishedAt: "2026-04-03T09:15:00Z",
    category: "business",
  },
  {
    id: "article-003",
    source: "Orbit Weekly",
    title: "A compact telescope design could widen access to deep-space imaging",
    body: "Researchers are testing a lighter mirror assembly and a simplified tracking system aimed at lowering the cost of high-resolution space imaging. Universities and smaller observatories say the approach could make deep-space observation programs far more attainable over the next few years.",
    imageUrl: "",
    publishedAt: "2026-04-03T10:30:00Z",
    category: "science",
  },
  {
    id: "article-004",
    source: "World Brief",
    title: "Port upgrades speed up trade routes across the eastern Mediterranean",
    body: "Several major ports have completed logistics upgrades that reduce cargo turnaround times and improve customs processing. Shipping firms say the changes are already shortening delays for regional trade lanes and making alternative routes more resilient during peak demand periods.",
    imageUrl: "",
    publishedAt: "2026-04-03T11:10:00Z",
    category: "world",
  },
  {
    id: "article-005",
    source: "Studio Ledger",
    title: "Indie film houses lean on smaller crews and faster release windows",
    body: "Independent studios are reorganizing production schedules around shorter shoots and tighter release windows. Producers say the model helps them respond to audience trends more quickly while preserving room for experimental storytelling and lower-budget risk-taking.",
    imageUrl: "",
    publishedAt: "2026-04-03T11:40:00Z",
    category: "culture",
  },
  {
    id: "article-006",
    source: "Touchline Report",
    title: "Clubs are using recovery analytics to extend peak seasons for players",
    body: "Elite clubs are expanding the use of sleep, hydration and movement tracking to manage player fatigue. Performance teams say recovery data is becoming a decisive edge during compressed schedules because it helps coaches rotate lineups without losing structure.",
    imageUrl: "",
    publishedAt: "2026-04-03T12:05:00Z",
    category: "sports",
  },
  {
    id: "article-007",
    source: "Civic Stack",
    title: "Cities test curbside sensors to ease delivery traffic in dense downtowns",
    body: "Urban planners are trialing curbside sensor networks that measure loading zone use, traffic buildup and repeat parking violations. Supporters say the pilots could make delivery fleets more predictable while freeing up bus lanes and pedestrian crossings during rush hour.",
    imageUrl: "",
    publishedAt: "2026-04-03T12:20:00Z",
    category: "technology",
  },
  {
    id: "article-008",
    source: "Finance North",
    title: "Mid-market firms are spending more on workflow automation than offices",
    body: "Advisers say medium-sized companies are shifting investment away from office expansion and into workflow automation, internal dashboards and finance tooling. The trend reflects a broader effort to keep margins stable while growing across distributed teams.",
    imageUrl: "",
    publishedAt: "2026-04-03T12:45:00Z",
    category: "business",
  },
  {
    id: "article-009",
    source: "Frontier Lab",
    title: "New battery chemistry shows promise for cold-weather delivery fleets",
    body: "Engineers say an updated battery chemistry is showing more stable performance in freezing conditions, a long-standing problem for electric delivery vehicles. Fleet operators are watching closely because winter reliability has been one of the biggest blockers to wider adoption.",
    imageUrl: "",
    publishedAt: "2026-04-03T13:10:00Z",
    category: "science",
  },
  {
    id: "article-010",
    source: "Global Desk",
    title: "Regional data-sharing pact aims to simplify emergency response planning",
    body: "Public agencies across several neighboring countries are piloting a data-sharing pact for flood, wildfire and evacuation coordination. Officials say shared situational dashboards could reduce duplicated effort and speed up response decisions when events cross borders.",
    imageUrl: "",
    publishedAt: "2026-04-03T13:35:00Z",
    category: "world",
  },
  {
    id: "article-011",
    source: "Culture Current",
    title: "Museum memberships rise as venues add late-night community programming",
    body: "Museums are seeing stronger membership growth after expanding late-night talks, workshops and small-format performances. Organizers say the strategy is turning cultural venues into more repeatable social spaces rather than occasional weekend destinations.",
    imageUrl: "",
    publishedAt: "2026-04-03T14:00:00Z",
    category: "culture",
  },
  {
    id: "article-012",
    source: "Arena Wire",
    title: "Women’s leagues are turning short-form highlights into subscription growth",
    body: "Media teams across several women’s sports leagues say short-form highlights are not just driving attention but converting viewers into subscribers and ticket buyers. Executives increasingly treat clips as the front door to deeper fan relationships rather than a side channel.",
    imageUrl: "",
    publishedAt: "2026-04-03T14:25:00Z",
    category: "sports",
  },
];
