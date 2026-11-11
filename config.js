const Config = {
  supabaseUrl: "",
  supabaseKey: "",
  maxVotes: 3,

  features: [
    {
      id: "calendar",
      title: "Sincronizare cu calendarul",
      text: "Google Calendar și Outlook, în ambele sensuri.",
    },
    {
      id: "offline",
      title: "Mod offline",
      text: "Îți planifici ziua chiar și fără internet.",
    },
    {
      id: "widget",
      title: "Widget pe ecranul principal",
      text: "Vezi ce urmează fără să deschizi aplicația.",
    },
    {
      id: "voice",
      title: "Adăugare cu vocea",
      text: "Spui sarcina, iar Tempo o pune la locul ei.",
    },
    {
      id: "teams",
      title: "Spații comune",
      text: "Planuri partajate cu familia sau cu echipa.",
    },
  ],

  rewards: [
    {
      at: 1,
      title: "Acces în primul val",
      text: "Intri cu o săptămână înaintea celorlalți.",
    },
    {
      at: 3,
      title: "3 luni Pro gratuit",
      text: "Toate funcțiile, fără costuri.",
    },
    {
      at: 10,
      title: "Pro pe viață",
      text: "Plătești o dată și nu mai plătești niciodată.",
    },
  ],
};
