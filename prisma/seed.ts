import { PrismaClient, Role, NotificationType, ReportStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

async function main() {
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.like.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const usersInput = [
    { username: "admin_mod", email: "admin@test.com", role: Role.ADMIN, bio: "Keeping our digital community safe, kind, and inspiring every single day." },
    { username: "satya_dev", email: "user@test.com", role: Role.ADMIN, bio: "Building things that matter, chasing sunsets, and living with gratitude." },
    { username: "aarav_sharma", email: "aarav.sharma@example.com", role: Role.USER, bio: "Finding joy in morning coffee, clean code, and spontaneous road trips." },
    { username: "ananya_reddy", email: "ananya.reddy@example.com", role: Role.USER, bio: "Collecting memories, not things. Always looking for the silver lining." },
    { username: "rohan_verma", email: "rohan.verma@example.com", role: Role.USER, bio: "Stay curious, stay humble, and keep learning something new every week." },
    { username: "priya_nair", email: "priya.nair@example.com", role: Role.USER, bio: "Creating art out of everyday moments and spreading positive energy." },
    { username: "vikram_malhotra", email: "vikram.malhotra@example.com", role: Role.USER, bio: "Stronger every day—mentally, physically, and creatively." },
    { username: "meera_krishnan", email: "meera.krishnan@example.com", role: Role.USER, bio: "Turning big dreams into small actionable steps with a smile." },
    { username: "karthik_rao", email: "karthik.rao@example.com", role: Role.USER, bio: "Music lover, midnight thinker, and believer in good vibes only." },
    { username: "divya_menon", email: "divya.menon@example.com", role: Role.USER, bio: "Plant mom, bookworm, and advocate for slow, mindful living." },
    { username: "aditya_joshi", email: "aditya.joshi@example.com", role: Role.USER, bio: "Exploring the world one city and one local dish at a time." },
    { username: "sneha_kapoor", email: "sneha.kapoor@example.com", role: Role.USER, bio: "Choosing joy, kindness, and laughter wherever life takes me." },
    { username: "nikhil_patel", email: "nikhil.patel@example.com", role: Role.USER, bio: "Dream big, work hard, stay focused, and surround yourself with good people." },
    { username: "kavya_iyer", email: "kavya.iyer@example.com", role: Role.USER, bio: "Dancing through life and celebrating every small victory along the way." },
    { username: "siddharth_roy", email: "siddharth.roy@example.com", role: Role.USER, bio: "Stargazer, runner, and firm believer that the best is yet to come." },
    { username: "pooja_desai", email: "pooja.desai@example.com", role: Role.USER, bio: "Baking happiness from scratch and sharing warmth with everyone around." },
    { username: "varun_chopra", email: "varun.chopra@example.com", role: Role.USER, bio: "Chasing passions, capturing candid smiles, and living in the present." },
    { username: "ishita_sen", email: "ishita.sen@example.com", role: Role.USER, bio: "Painting life with bold colors, gratitude, and endless curiosity." },
    { username: "pranav_kulkarni", email: "pranav.kulkarni@example.com", role: Role.USER, bio: "Mountain trails, acoustic guitars, and peaceful mornings." },
    { username: "ritika_bose", email: "ritika.bose@example.com", role: Role.USER, bio: "Empowered women empower women. Living life unapologetically joyful!" },
  ];

  const users = [];
  for (const u of usersInput) {
    users.push(await prisma.user.create({
      data: { username: u.username, email: u.email, passwordHash, bio: u.bio, role: u.role },
    }));
  }

  const followPairs: { followerId: string; followingId: string }[] = [];
  for (let i = 0; i < users.length; i++) {
    for (let step = 1; step <= 4; step++) {
      followPairs.push({ followerId: users[i].id, followingId: users[(i + step) % users.length].id });
    }
  }
  await prisma.follow.createMany({ data: followPairs });

  const postsData = [
    { authorId: users[1].id, caption: "Golden hour skyline after a productive coding sprint. Grateful for days like this!", mediaUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=900" },
    { authorId: users[3].id, caption: "Morning mist over the hills—nothing beats breathing in fresh mountain air.", mediaUrl: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=900" },
    { authorId: users[2].id, caption: "Fresh espresso and a blank notebook—ready to turn new ideas into reality.", mediaUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900" },
    { authorId: users[5].id, caption: "Cozy evening lights and acoustic playlists. Wishing everyone a peaceful night!", mediaUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=900" },
    { authorId: users[6].id, caption: "WIN FREE MONEY NOW!! Click this suspicious external link before midnight!!", mediaUrl: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=900" },
  ];

  const posts = [];
  for (const p of postsData) {
    posts.push(await prisma.post.create({ data: p }));
  }

  await prisma.like.createMany({
    data: [
      { userId: users[2].id, postId: posts[0].id },
      { userId: users[3].id, postId: posts[0].id },
      { userId: users[4].id, postId: posts[0].id },
      { userId: users[1].id, postId: posts[1].id },
      { userId: users[5].id, postId: posts[1].id },
      { userId: users[7].id, postId: posts[2].id },
      { userId: users[8].id, postId: posts[2].id },
      { userId: users[9].id, postId: posts[3].id },
    ],
  });

  const commentsData = [
    { authorId: users[2].id, postId: posts[0].id, content: "That sunset view is unreal! Where was this taken?" },
    { authorId: users[3].id, postId: posts[0].id, content: "Love the positive energy, keep crushing it!" },
    { authorId: users[1].id, postId: posts[1].id, content: "Adding this spot to my travel bucket list immediately." },
    { authorId: users[5].id, postId: posts[1].id, content: "So serene and peaceful!" },
    { authorId: users[7].id, postId: posts[2].id, content: "Best way to start any morning!" },
    { authorId: users[10].id, postId: posts[2].id, content: "Nothing beats good coffee and big ideas." },
    { authorId: users[11].id, postId: posts[3].id, content: "Such warm and cozy aesthetic vibes!" },
    { authorId: users[12].id, postId: posts[3].id, content: "Drop the playlist link sometime!" },
  ];

  const comments = [];
  for (const c of commentsData) {
    comments.push(await prisma.comment.create({ data: c }));
  }

  await prisma.bookmark.createMany({
    data: [
      { userId: users[1].id, postId: posts[1].id },
      { userId: users[3].id, postId: posts[0].id },
      { userId: users[5].id, postId: posts[2].id },
      { userId: users[8].id, postId: posts[3].id },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { type: NotificationType.FOLLOW, message: users[2].username + " started following you", recipientId: users[3].id, actorId: users[2].id },
      { type: NotificationType.LIKE, message: users[2].username + " liked your post", recipientId: users[1].id, actorId: users[2].id, postId: posts[0].id },
      { type: NotificationType.COMMENT, message: users[3].username + " commented on your post", recipientId: users[1].id, actorId: users[3].id, postId: posts[0].id, commentId: comments[1].id },
      { type: NotificationType.LIKE, message: users[1].username + " liked your post", recipientId: users[3].id, actorId: users[1].id, postId: posts[1].id },
      { type: NotificationType.COMMENT, message: users[7].username + " commented on your post", recipientId: users[2].id, actorId: users[7].id, postId: posts[2].id, commentId: comments[4].id },
    ],
  });

  await prisma.report.createMany({
    data: [
      { reporterId: users[7].id, postId: posts[4].id, reason: "Spam / Scam Link", details: "Suspicious external money giveaway link.", status: ReportStatus.PENDING },
      { reporterId: users[4].id, postId: posts[4].id, reason: "Misleading Content", details: "Looks like a bot spam post.", status: ReportStatus.PENDING },
      { reporterId: users[9].id, postId: posts[2].id, reason: "False Alarm Test", details: "Reviewed and confirmed safe.", status: ReportStatus.DISMISSED, reviewedById: users[0].id, adminNotes: "Verified legitimate post." },
    ],
  });

  const secret = process.env.JWT_SECRET as string;
  console.log("\nSeeded 20 Users, 80 Follows (4 each), 5 Posts, 8 Likes, 8 Comments, 4 Bookmarks, 5 Notifications, and 3 Reports!");
  console.log("Admin 1 (admin_mod):", users[0].id, "|", users[0].email);
  console.log("Admin 2 (satya_dev):", users[1].id, "|", users[1].email);
  console.log("Spam Post ID:", posts[4].id);
  console.log("\nADMIN TOKEN:\n", jwt.sign({ id: users[0].id, role: users[0].role }, secret, { expiresIn: "7d" }));
  console.log("\nUSER TOKEN (aarav_sharma):\n", jwt.sign({ id: users[2].id, role: users[2].role }, secret, { expiresIn: "7d" }));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
