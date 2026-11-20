// All guide text lives here as plain data, so the page can render it AND search it.
export type Block =
  | { t: 'p'; text: string }
  | { t: 'steps'; items: string[] }
  | { t: 'list'; items: string[] }
  | { t: 'tip'; text: string }
  | { t: 'warn'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'link'; to: string; text: string };

export interface Section {
  id: string;
  title: string;
  summary: string;
  blocks: Block[];
}

export const sections: Section[] = [
  {
    id: 'quick-start',
    title: 'Quick start',
    summary: 'Your first expense in five minutes.',
    blocks: [
      { t: 'steps', items: [
        'Open Groups and press New group. Name it (for example "Goa Trip") and pick a category.',
        'Add the people who share costs with you. Type their names, or pick a friend if you have already connected.',
        'Open the group, go to Expenses and press Add expense. Enter what it was, the amount, who paid and who shares it.',
        'Open the Balances tab to see who owes whom, and the suggested payments that settle everything.',
        'When someone pays, press Mark as paid. Everyone\'s balance updates straight away.',
      ] },
      { t: 'tip', text: 'You do not need everyone to have an account. People you add by name can be linked to their account later with a claim link.' },
      { t: 'link', to: '/groups', text: 'Go to Groups' },
    ],
  },
  {
    id: 'signing-in',
    title: 'Signing in',
    summary: 'Create a unique username and password.',
    blocks: [
      { t: 'p', text: 'Create an account with a unique username and password, then use those credentials to sign in. Usernames are case-insensitive and appear as your name in groups.' },
      { t: 'list', items: [
        'Use at least 8 characters for your password.',
        'Choose a password you can remember; password reset by email is not enabled.',
        'Existing email-code accounts can sign in with a one-time code and set a username and password.',
      ] },
      { t: 'p', text: 'Use Sign out (bottom of the sidebar, or the menu on a phone) when you are on a shared computer.' },
    ],
  },
  {
    id: 'groups',
    title: 'Groups and members',
    summary: 'Create groups, add people, invite by link, leave a group.',
    blocks: [
      { t: 'p', text: 'A group is a set of people who share costs: a flat, a trip, a friend circle. Balances are tracked inside each group, so a trip never mixes with your flat.' },
      { t: 'table', head: ['Category', 'Good for'], rows: [
        ['Flatmates', 'Rent, groceries, utilities, anything recurring'],
        ['Travel', 'Trips and holidays with stays, food and transport'],
        ['Friends & Family', 'Dinners, gifts, one-off events'],
      ] },
      { t: 'p', text: 'There are three ways to add someone:' },
      { t: 'list', items: [
        'By name. Quick and needs no account. They appear in splits and balances right away.',
        'From your friends. Only accepted friends can be added this way, and they get a notification.',
        'With an invitation link. Open the Members tab and create a link (it works for 7 days). Anyone who opens it and signs in joins the group.',
      ] },
      { t: 'p', text: 'Added someone by name who now has an account? Create a claim link for that person on the Members tab. When they open it, their account is attached to the existing member, and all their history stays.' },
      { t: 'warn', text: 'To leave a group your balance must be zero. Settle up first. Your past expenses stay in the group so everyone\'s numbers remain correct.' },
    ],
  },
  {
    id: 'expenses',
    title: 'Adding expenses and splitting',
    summary: 'Equal, exact, percentage and share-based splits, with examples.',
    blocks: [
      { t: 'p', text: 'Every expense has a description, an amount, a date, a category, who paid, and who shares it. The preview in the form shows each person\'s share before you save, and the server double-checks it.' },
      { t: 'p', text: 'Worked example: ₹1,000 dinner paid by Asha, shared by Asha, Riya and Kabir.' },
      { t: 'table', head: ['Method', 'You enter', 'Result'], rows: [
        ['Equal', 'Nothing', '₹333.34, ₹333.33, ₹333.33 (the odd paisa goes to the first person)'],
        ['Exact amount', '₹500, ₹300, ₹200', 'Exactly those. They must add up to the total.'],
        ['Percentage', '50%, 30%, 20%', '₹500, ₹300, ₹200. Percentages must add up to 100.'],
        ['Shares', '2, 1, 1', '₹500, ₹250, ₹250 (Asha has two shares, the others one each)'],
      ] },
      { t: 'tip', text: 'Money is kept in whole paise, so splits always add up exactly. There are no hidden rounding differences.' },
      { t: 'list', items: [
        'The person who paid does not have to be part of the split (for example, when you pay a gift for others).',
        'Pick the right category: charts and the monthly recap use it.',
        'Use notes for details like a bill number. Back-dated expenses are fine.',
        'Everyone with an account in the group gets an in-app notification, including their share.',
      ] },
    ],
  },
  {
    id: 'balances',
    title: 'Balances and settling up',
    summary: 'Who owes whom and how to clear it.',
    blocks: [
      { t: 'p', text: 'A balance is what you paid for the group, minus your share of everything, adjusted by payments already recorded. Green means you are owed money. Red means you owe money. All balances in a group add up to zero.' },
      { t: 'p', text: 'The Balances tab suggests payments that clear the group using a small number of transfers (never more than the number of people minus one). It does not matter who originally paid for what.' },
      { t: 'steps', items: [
        'Pay the person outside the app, by UPI, cash or any way you like. SplitSync does not move money.',
        'Press Mark as paid next to the suggested payment.',
        'Balances update for everyone and the payment shows in the payment history.',
      ] },
      { t: 'warn', text: 'Double taps are safe: a payment can only be recorded once, and a payment larger than the amount owed is refused. Only the payer, the receiver or a group admin can record a payment.' },
    ],
  },
  {
    id: 'friends',
    title: 'Friends',
    summary: 'Find people by username and connect.',
    blocks: [
      { t: 'p', text: 'Open Friends, enter the exact username of a person and send a request. You cannot browse other users, which keeps everyone\'s details private.' },
      { t: 'list', items: [
        'If they already sent you a request, sending one back accepts theirs.',
        'You are notified when a request arrives and when yours is accepted.',
        'Either person can remove a friendship at any time. Existing groups are not affected.',
      ] },
    ],
  },
  {
    id: 'timeline',
    title: 'Timeline and CSV export',
    summary: 'Your personal history across all groups.',
    blocks: [
      { t: 'p', text: 'The Timeline lists every expense you paid for or share, and every payment you made or received, across all groups. Filter by group, category, type and dates, or search by description.' },
      { t: 'list', items: [
        '"Your spending" counts only your own share of each expense, never the group total.',
        '"Total of expenses you paid" is what you covered upfront, which others will pay back.',
        'Export CSV downloads exactly what the current filters show, ready for a spreadsheet.',
      ] },
      { t: 'link', to: '/timeline', text: 'Open the Timeline' },
    ],
  },
  {
    id: 'insights',
    title: 'Insights and analytics charts',
    summary: 'How to read the charts.',
    blocks: [
      { t: 'p', text: 'Insights shows your own spending over the last 3, 6 or 12 months. Pick a single group to focus on it.' },
      { t: 'table', head: ['Chart', 'What it tells you'], rows: [
        ['Spending by month', 'Your share each month. The current month is highlighted. Hover a bar for details.'],
        ['By category', 'The ring shows how your spending splits across food, rent, travel and so on, with percentages.'],
        ['By group', 'Which groups take most of your money.'],
        ['Day of the week', 'When you spend most. Often weekends for trips and dinners.'],
        ['Your biggest shares', 'The five largest amounts you owe, linked to the expense.'],
      ] },
      { t: 'tip', text: 'Charts follow the expense date, not when you entered it. Back-dated expenses land in the right month.' },
      { t: 'p', text: 'Inside a group, the Insights tab shows the same kind of view for the whole group: spending by category and month, who paid and who owes, and how to settle up.' },
      { t: 'link', to: '/insights', text: 'Open Insights' },
    ],
  },
  {
    id: 'recap',
    title: 'Monthly recap',
    summary: 'Your month in numbers, with a comparison to last month.',
    blocks: [
      { t: 'p', text: 'The recap turns one month into a short story: total spent, change versus the month before, top category, biggest expense, priciest day, payments sent and received, and a day-by-day chart.' },
      { t: 'list', items: [
        'Use the arrows to move between months. You cannot go past the current month.',
        'At the start of each month, the next time you open the app, you get a notification that last month\'s recap is ready (only if you had spending in it).',
        'CSV downloads that month\'s transactions. Print / PDF saves a clean copy using your browser\'s print dialog (choose "Save as PDF").',
      ] },
      { t: 'link', to: '/recap', text: 'Open the recap' },
    ],
  },
  {
    id: 'sharing',
    title: 'Shareable reports',
    summary: 'Send a read-only report to anyone, safely.',
    blocks: [
      { t: 'p', text: 'You can share your monthly recap, or a group report, as a link. The person opening it does not need an account.' },
      { t: 'steps', items: [
        'Open the Monthly recap, or a group\'s Insights tab, and press Share.',
        'Choose how long the link works (1 to 90 days) and press Create link.',
        'Copy the link or use Send to share it with any app on your phone.',
      ] },
      { t: 'list', items: [
        'The report is a snapshot taken when you create the link. New expenses later do not change it.',
        'Personal recaps show your spending and group names. Group reports show member names, what each paid and who owes whom. Share only with people you trust.',
        'Active links are listed in the Share window with their view counts. Press Turn off to disable one immediately.',
        'Links are long random strings and are not indexed by search engines. Anyone who has the link can open it, so treat it like a private document.',
      ] },
      { t: 'warn', text: 'You see the link only once, right after creating it. If you lose it, turn the old link off and make a new one.' },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    summary: 'What triggers them and how to manage them.',
    blocks: [
      { t: 'p', text: 'The bell in the top bar shows how many notifications are unread. The app checks for new ones every 30 seconds, and a small pop-up appears when something arrives while you are using it.' },
      { t: 'table', head: ['You are told when', 'Where it takes you'], rows: [
        ['Someone adds an expense that involves you', 'That expense in the group'],
        ['Someone records a payment to or from you', 'The group'],
        ['You are added to a group, or someone joins by link', 'The group'],
        ['A friend request arrives or is accepted', 'Friends'],
        ['Last month\'s recap is ready', 'The recap for that month'],
      ] },
      { t: 'list', items: [
        'You are never notified about your own actions.',
        'Click a notification to open it and mark it read, or use Mark all read.',
        'The Notifications page keeps your latest 50, with an Unread filter.',
      ] },
      { t: 'link', to: '/notifications', text: 'Open Notifications' },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and security',
    summary: 'What is protected and how.',
    blocks: [
      { t: 'list', items: [
        'You only ever see groups you belong to. Anything else answers "not found".',
        'Sign-in codes and session tokens are stored hashed. Sessions use an HttpOnly cookie that scripts cannot read.',
        'Money-moving requests carry a one-time key, so a double click or a retry never records something twice.',
        'The server calculates all splits and balances. The browser only displays them.',
        'The activity log is append-only: entries cannot be edited or deleted.',
        'Shared report links store only a hash of the link, expire on their own, and can be turned off at any time.',
      ] },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    summary: 'Fixes for common problems.',
    blocks: [
      { t: 'table', head: ['Problem', 'What to try'], rows: [
        ['I cannot sign in', 'Check that your username is spelled correctly. Password reset by email is not enabled. Existing email-code accounts can use the legacy sign-in option once to set username credentials.'],
        ['"Code has expired"', 'Codes last 10 minutes and lock after 5 wrong tries. Request a new one.'],
        ['Payment "more than what is owed"', 'It was probably already recorded, or balances changed. Refresh the Balances tab.'],
        ['I cannot leave a group', 'Your balance must be zero. Settle up first.'],
        ['A shared link says invalid or expired', 'It was turned off or passed its expiry. Ask the sender for a new one.'],
        ['The bell does not update', 'It refreshes every 30 seconds, and when you return to the tab. Reload the page if it seems stuck.'],
        ['Charts look empty', 'Charts use the expense date and your own share. Check the time range and group filter.'],
      ] },
    ],
  },
];

export const faqs: { q: string; a: string }[] = [
  { q: 'Does SplitSync move real money?', a: 'No. It keeps the books. You pay each other by UPI, cash or any method you like, then record it with Mark as paid.' },
  { q: 'Why does my spending look smaller than the bills I added?', a: 'Spending always means your share. If you pay a ₹3,000 bill split three ways, your spending is ₹1,000. The ₹3,000 appears under "You paid upfront".' },
  { q: 'Can I edit or delete an expense?', a: 'Not yet. Editing with a full audit history is planned. For now, add a correcting expense and explain it in the notes.' },
  { q: 'What is the difference between a balance and spending?', a: 'A balance is money still owed between people right now. Spending is what you consumed in a period. Settling up changes balances, never spending.' },
  { q: 'Who can see my shared report?', a: 'Anyone who has the link, until it expires or you turn it off. They see a frozen snapshot, never your live data or your other groups.' },
  { q: 'Is the amount in the report the same later?', a: 'Yes. A shared report is a snapshot. Create a new link to share updated numbers.' },
  { q: 'Which currency does it use?', a: 'Indian rupees (₹), with Indian digit grouping, for example ₹1,25,000.' },
  { q: 'I was added by name before I signed up. How do I get my history?', a: 'Ask the group admin for a claim link for your name. Opening it attaches your account to that member.' },
];

export const glossary: { term: string; meaning: string }[] = [
  { term: 'Balance', meaning: 'What you are owed (positive) or owe (negative) inside one group.' },
  { term: 'Share', meaning: 'The part of an expense that belongs to you.' },
  { term: 'Paid upfront', meaning: 'The full amount of bills you paid for the group.' },
  { term: 'Settlement', meaning: 'A recorded payment between two members that reduces what is owed.' },
  { term: 'Claim link', meaning: 'A one-time link that attaches an account to a member who was added by name.' },
  { term: 'Snapshot', meaning: 'A frozen copy of a report taken when the share link was created.' },
  { term: 'Paise', meaning: 'One hundredth of a rupee. SplitSync stores all money in paise so totals are always exact.' },
];
