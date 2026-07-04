import { Telegraf, Markup } from "telegraf";
import fs from "fs";

const bot = new Telegraf(process.env.BOT_TOKEN);

// 👑 ادمین
const ADMIN_ID = 6364932669;

// 📢 کانال اجباری
const CHANNEL_USERNAME = "@PainxSorrow";

const DB_FILE = "./db.json";
const PAGE_SIZE = 7;

// ---------- DB ----------
function loadDB() {
    if (!fs.existsSync(DB_FILE)) return [];
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ---------- CHECK MEMBERSHIP ----------
async function isMember(userId) {
    try {
        const res = await bot.telegram.getChatMember(
            CHANNEL_USERNAME,
            userId
        );

        return (
            res.status === "member" ||
            res.status === "administrator" ||
            res.status === "creator"
        );
    } catch {
        return false;
    }
}

// ---------- KEYBOARD ----------
function getKeyboard(page = 0) {
    const db = loadDB();

    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    const items = db.slice(start, end);

    const buttons = [];

    for (let i = 0; i < items.length; i++) {
        buttons.push([
            Markup.button.callback(items[i].title, `song_${start + i}`)
        ]);
    }

    const nav = [];

    if (page > 0) {
        nav.push(Markup.button.callback("⬅️ قبلی", `page_${page - 1}`));
    }

    if (end < db.length) {
        nav.push(Markup.button.callback("بعدی ➡️", `page_${page + 1}`));
    }

    if (nav.length) buttons.push(nav);

    buttons.push([
        Markup.button.callback("🎲 آهنگ شانسی", "random")
    ]);

    return Markup.inlineKeyboard(buttons);
}

// ---------- START ----------
bot.start(async (ctx) => {

    const ok = await isMember(ctx.from.id);

    if (!ok) {
        return ctx.reply(
            `⚠️ برای استفاده از ربات باید عضو کانال باشید:

👉 ${CHANNEL_USERNAME}`,

            Markup.inlineKeyboard([
                [
                    Markup.button.url(
                        "📢 عضویت در کانال",
                        `https://t.me/${CHANNEL_USERNAME.replace("@", "")}`
                    )
                ],
                [
                    Markup.button.callback("🔄 بررسی عضویت", "check")
                ]
            ])
        );
    }

    // welcome text with pic
    await ctx.replyWithPhoto(
        "https://t.me/PainxSorrow/455",
        {
            caption: `🎵 خوش آمدی!

به ربات shadow خوش اومدی 🕊️

👇 از لیست زیر آهنگ انتخاب کن`
        }
    );

    await ctx.reply("🎵 لیست آهنگ‌ها", getKeyboard(0));
});

// ---------- CHECK BUTTON ----------
bot.action("check", async (ctx) => {
    const ok = await isMember(ctx.from.id);

    if (!ok) {
        return ctx.answerCbQuery("⚠️ هنوز عضو کانال نشدی");
    }

    await ctx.editMessageText(
        `🎵 خوش آمدی!

👇 از لیست زیر آهنگ انتخاب کن`,
        getKeyboard(0)
    );

    await ctx.answerCbQuery("✅ تایید شد");
});

// ---------- HELP ----------
bot.command("help", async (ctx) => {

    const ok = await isMember(ctx.from.id);
    if (!ok) return ctx.reply("⚠️ اول باید عضو کانال بشی");

    await ctx.reply(
        `📌 راهنما:

🎵 انتخاب آهنگ
🎲 آهنگ شانسی

👑 فقط ادمین آهنگ اضافه می‌کند`
    );
});

// ---------- ADD SONG (ADMIN ONLY) ----------
bot.on("message", async (ctx) => {

    if (ctx.from.id !== ADMIN_ID) return;

    const msg = ctx.message;

    const isMusic =
        msg.audio ||
        msg.document ||
        msg.voice ||
        msg.video ||
        msg.forward_date;

    if (!isMusic) return;

    const db = loadDB();

    const title =
        msg.caption ||
        msg.audio?.title ||
        msg.document?.file_name ||
        (msg.voice ? "🎤 ویس" : "🎵 بدون عنوان");

    db.unshift({
        title,
        messageId: msg.message_id
    });

    saveDB(db);

    await ctx.reply("👌 آهنگ ذخیره شد");
});

// ---------- PAGINATION ----------
bot.action(/^page_(\d+)$/, async (ctx) => {

    const ok = await isMember(ctx.from.id);
    if (!ok) return ctx.answerCbQuery("❌ عضو کانال نیستی");

    const page = Number(ctx.match[1]);

    await ctx.editMessageReplyMarkup(
        getKeyboard(page).reply_markup
    );

    await ctx.answerCbQuery();
});

// ---------- PLAY SONG ----------
bot.action(/^song_(\d+)$/, async (ctx) => {

    const ok = await isMember(ctx.from.id);
    if (!ok) return ctx.answerCbQuery("❌ عضو کانال نیستی");

    const db = loadDB();
    const song = db[Number(ctx.match[1])];

    if (!song) return ctx.answerCbQuery("یافت نشد");

    await ctx.telegram.copyMessage(
        ctx.chat.id,
        ctx.chat.id,
        song.messageId
    );

    await ctx.answerCbQuery();
});

// ---------- RANDOM ----------
bot.action("random", async (ctx) => {

    const ok = await isMember(ctx.from.id);
    if (!ok) return ctx.answerCbQuery("❌ عضو کانال نیستی");

    const db = loadDB();
    if (!db.length) return ctx.answerCbQuery("خالیه");

    const song = db[Math.floor(Math.random() * db.length)];

    await ctx.telegram.copyMessage(
        ctx.chat.id,
        ctx.chat.id,
        song.messageId
    );

    await ctx.answerCbQuery("🎲");
});

// ---------- ERROR ----------
bot.catch(console.error);

bot.launch();

console.log("✅ Music Bot Running (FORCE JOIN VERSION)");
