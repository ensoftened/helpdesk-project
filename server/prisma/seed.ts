// This script fills the database with sample data so we can test the app.
// It runs after "prisma db push" or "prisma migrate dev".
// Think of it like setting up a demo room before showing a house.
//
// We use the @prisma/client library (generated from our schema) to create
// records. Each record is like a row in a spreadsheet.
//
// NEW CONCEPT: bcrypt is a password-hashing library. It turns a password
// like "password123" into a scrambled string. Even if someone steals the
// database, they can't read the original passwords. This is called
// "one-way hashing" — you can go forward but never backward.

import { PrismaClient, UserRole, TicketStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";

// Create a Prisma client instance — our connection to the database
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data (delete in reverse order to avoid foreign key errors)
  await prisma.attachment.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.sLA.deleteMany();
  await prisma.category.deleteMany();
  await prisma.priority.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  console.log("Cleared existing data");

  // ─── TEAMS ────────────────────────────────────────────────────
  const supportTeam = await prisma.team.create({
    data: { name: "IT Support", description: "Handles hardware and software issues" },
  });
  const opsTeam = await prisma.team.create({
    data: { name: "Operations", description: "Handles network and infrastructure" },
  });
  console.log("Created 2 teams");

  // ─── USERS ────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("password123", 10);

  const requester = await prisma.user.create({
    data: { email: "requester@helpdesk.com", passwordHash: hashedPassword, name: "Alice Requester", role: UserRole.Requester, isActive: true },
  });
  const agent = await prisma.user.create({
    data: { email: "agent@helpdesk.com", passwordHash: hashedPassword, name: "Bob Agent", role: UserRole.Agent, teamId: supportTeam.id, isActive: true },
  });
  const admin = await prisma.user.create({
    data: { email: "admin@helpdesk.com", passwordHash: hashedPassword, name: "Charlie Admin", role: UserRole.Admin, isActive: true },
  });
  const requester2 = await prisma.user.create({
    data: { email: "dave@company.com", passwordHash: hashedPassword, name: "Dave User", role: UserRole.Requester, isActive: true },
  });
  const requester3 = await prisma.user.create({
    data: { email: "eve@company.com", passwordHash: hashedPassword, name: "Eve User", role: UserRole.Requester, isActive: true },
  });
  const agent2 = await prisma.user.create({
    data: { email: "frank@helpdesk.com", passwordHash: hashedPassword, name: "Frank Agent", role: UserRole.Agent, teamId: opsTeam.id, isActive: true },
  });
  const requester4 = await prisma.user.create({
    data: { email: "grace@company.com", passwordHash: hashedPassword, name: "Grace User", role: UserRole.Requester, isActive: true },
  });
  console.log("Created 7 users");

  // ─── CATEGORIES ────────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.create({ data: { name: "Hardware", description: "Physical equipment issues", defaultTeamId: supportTeam.id } }),
    prisma.category.create({ data: { name: "Software", description: "Application and OS issues", defaultTeamId: supportTeam.id } }),
    prisma.category.create({ data: { name: "Network", description: "Connectivity and access issues", defaultTeamId: opsTeam.id } }),
    prisma.category.create({ data: { name: "Account", description: "Login, password, and access issues", defaultTeamId: opsTeam.id } }),
    prisma.category.create({ data: { name: "Other", description: "Anything not covered above", defaultTeamId: null } }),
  ]);
  console.log(`Created ${categories.length} categories`);

  // ─── PRIORITIES ────────────────────────────────────────────────
  const priorities = await Promise.all([
    prisma.priority.create({ data: { name: "Low", level: 1 } }),
    prisma.priority.create({ data: { name: "Medium", level: 2 } }),
    prisma.priority.create({ data: { name: "High", level: 3 } }),
    prisma.priority.create({ data: { name: "Urgent", level: 4 } }),
  ]);
  console.log(`Created ${priorities.length} priorities`);

  // ─── SLA RULES ─────────────────────────────────────────────────
  const slaData = [
    { categoryId: null, priorityId: priorities[0].id, responseHours: 48, resolutionHours: 168 },
    { categoryId: null, priorityId: priorities[1].id, responseHours: 24, resolutionHours: 72 },
    { categoryId: null, priorityId: priorities[2].id, responseHours: 4, resolutionHours: 24 },
    { categoryId: null, priorityId: priorities[3].id, responseHours: 1, resolutionHours: 4 },
    { categoryId: categories[0].id, priorityId: priorities[0].id, responseHours: 72, resolutionHours: 240 },
    { categoryId: categories[0].id, priorityId: priorities[1].id, responseHours: 24, resolutionHours: 96 },
    { categoryId: categories[1].id, priorityId: priorities[2].id, responseHours: 4, resolutionHours: 8 },
    { categoryId: categories[2].id, priorityId: priorities[3].id, responseHours: 1, resolutionHours: 2 },
  ];
  await prisma.sLA.createMany({ data: slaData });
  console.log(`Created ${slaData.length} SLA rules`);
// ─── TICKET CREATION LOOP ─────────────────────────────────────
  // We define an array of ticket fields and create each one in a loop.
  // This keeps the code DRY (Don't Repeat Yourself).
  //
  // Each ticket uses short key names:
  //   t = title, d = description, s = status, p = priorityId,
  //   c = categoryId, r = requesterId, a = assigneeId (optional),
  // ─── TICKET CREATION LOOP ─────────────────────────────────────
  // Each ticket definition has short key names to keep it concise:
  //   t = title, d = description, s = status key,
  //   p = priority index (0=Low,1=Medium,2=High,3=Urgent),
  //   c = category index (0=Hardware,1=Software,2=Network,3=Account,4=Other),
  //   r = requester key ("requester","requester2","requester3","requester4"),
  //   a = assignee key (optional — "agent" or "agent2"),
  //   tm = team key ("support" or "ops")
  const tickets = [
    { t: "Computer won't start", d: "Desktop beeps and shows black screen", s: "Open", p: 0, c: 0, r: "requester", tm: "support" },
    { t: "Email not syncing", d: "Outlook stopped receiving messages", s: "Open", p: 1, c: 1, r: "requester2", tm: "support" },
    { t: "WiFi keeps dropping", d: "Connection drops every 10 min", s: "Open", p: 2, c: 2, r: "requester3", tm: "ops" },
    { t: "Password reset needed", d: "Locked out after too many attempts", s: "Open", p: 2, c: 3, r: "requester", tm: "support" },
    { t: "Printer jam 3rd floor", d: "Main printer jammed, grinding noise", s: "Open", p: 1, c: 0, r: "requester4", tm: "ops" },
    { t: "Software install request", d: "Need Adobe Photoshop installed", s: "Open", p: 0, c: 1, r: "requester2", tm: "support" },
    { t: "VPN not connecting", d: "Error 800 connecting to VPN", s: "Open", p: 1, c: 2, r: "requester3", tm: "ops" },
    { t: "Monitor flickering", d: "Screen flickers above 70% brightness", s: "Open", p: 0, c: 0, r: "requester", tm: "support" },
    { t: "Shared drive access", d: "Network drive Z: inaccessible", s: "In_Progress", p: 1, c: 2, r: "requester4", a: "agent2", tm: "ops" },
    { t: "Blue screen after update", d: "Windows update caused BSOD", s: "In_Progress", p: 2, c: 1, r: "requester2", a: "agent", tm: "support" },
    { t: "Keyboard not working", d: "E and T keys stopped responding", s: "In_Progress", p: 1, c: 0, r: "requester3", a: "agent", tm: "support" },
    { t: "Slack not loading", d: "Stuck on Connecting screen", s: "In_Progress", p: 0, c: 1, r: "requester", a: "agent", tm: "support" },
    { t: "Headset mic not working", d: "Can't be heard on calls", s: "In_Progress", p: 1, c: 0, r: "requester4", a: "agent2", tm: "ops" },
    { t: "Software license renewal", d: "Budget approval needed for renewal", s: "Waiting_on_Requester", p: 0, c: 4, r: "requester3", a: "agent", tm: "support" },
    { t: "New monitor request", d: "Requesting 27-inch monitor", s: "Waiting_on_Requester", p: 0, c: 0, r: "requester", a: "agent", tm: "support" },
    { t: "Access card replacement", d: "Lost building access card", s: "Waiting_on_Requester", p: 1, c: 3, r: "requester4", a: "agent2", tm: "ops" },
    { t: "Mouse cursor jumping", d: "Cursor skips around randomly", s: "Resolved", p: 0, c: 0, r: "requester2", a: "agent", tm: "support" },
    { t: "Login page slow", d: "SSO login takes 30+ seconds", s: "Resolved", p: 1, c: 2, r: "requester3", a: "agent2", tm: "ops" },
    { t: "Excel crashes large files", d: "Excel crashes >50MB files", s: "Resolved", p: 1, c: 1, r: "requester", a: "agent", tm: "support" },
    { t: "Phone not charging", d: "Work phone battery drains fast", s: "Resolved", p: 0, c: 0, r: "requester4", a: "agent2", tm: "ops" },
    { t: "Calendar sync issue", d: "Google Calendar not in Outlook", s: "Resolved", p: 0, c: 1, r: "requester2", a: "agent", tm: "support" },
    { t: "Desk phone not ringing", d: "Calls go to voicemail", s: "Closed", p: 0, c: 0, r: "requester3", a: "agent2", tm: "ops" },
    { t: "Website blocked firewall", d: "Cannot access research site", s: "Closed", p: 1, c: 2, r: "requester", a: "agent2", tm: "ops" },
    { t: "2FA broken", d: "Not receiving SMS codes", s: "Closed", p: 2, c: 3, r: "requester4", a: "agent", tm: "support" },
    { t: "Battery draining laptop", d: "Full charge lasts 30 min", s: "Closed", p: 0, c: 0, r: "requester2", a: "agent", tm: "support" },
    { t: "File share permission", d: "Cannot access Marketing folder", s: "Closed", p: 1, c: 2, r: "requester3", a: "agent2", tm: "ops" },
    { t: "Antivirus false positive", d: "Internal tool flagged as malware", s: "Closed", p: 1, c: 1, r: "requester", a: "agent", tm: "support" },
    { t: "Server room temp high", d: "AC unit not cooling, issue returned", s: "Reopened", p: 3, c: 0, r: "requester4", a: "agent2", tm: "ops" },
    { t: "Email signatures missing", d: "Company signatures disappeared again", s: "Reopened", p: 1, c: 1, r: "requester2", a: "agent", tm: "support" },
  ];

  console.log(`Creating ${tickets.length} tickets...`);

  // Lookup maps - resolve user keys to actual user objects
  const requesterMap: Record<string, typeof requester> = {
    requester: requester,
    requester2: requester2,
    requester3: requester3,
    requester4: requester4,
  };
  const assigneeMap: Record<string, typeof agent> = {
    agent: agent,
    agent2: agent2,
  };

  // Create each ticket one by one, along with its audit log and comments
  for (const td of tickets) {
    // Build the ticket record using the lookup maps
    const ticket = await prisma.ticket.create({
      data: {
        title: td.t,
        description: td.d,
        status: TicketStatus[td.s as keyof typeof TicketStatus],
        priorityId: priorities[td.p].id,
        categoryId: categories[td.c].id,
        requesterId: requesterMap[td.r].id,
        assigneeId: td.a ? assigneeMap[td.a].id : undefined,
        teamId: td.tm === "support" ? supportTeam.id : opsTeam.id,
      },
    });

    // Log the creation of this ticket in the audit log
    await prisma.auditLog.create({
      data: {
        ticketId: ticket.id,
        changedByUserId: ticket.requesterId,
        field: "created",
        oldValue: null,
        newValue: "Ticket created",
      },
    });

    // Add 1-2 sample comments for richer test data
    const commentSamples = [
      "I am looking into this and will update you soon.",
      "Thanks for reporting! Can you provide more details?",
      "Internal note: checking with the infrastructure team.",
      "This should be resolved by end of day.",
      "I have escalated to the appropriate team.",
    ];
    const numComments = 1 + (tickets.indexOf(td) % 2); // alternates 1,2,1,2...
    const commenterId = td.a ? assigneeMap[td.a].id : agent.id;

    for (let i = 0; i < numComments; i++) {
      await prisma.comment.create({
        data: {
          body: commentSamples[i],
          isInternal: i === 2, // the "Internal note" is hidden from requesters
          ticketId: ticket.id,
          userId: commenterId,
        },
      });
    }
  }

  console.log(`Created ${tickets.length} tickets with comments and audit logs`);
  console.log("Database seeded successfully!");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });