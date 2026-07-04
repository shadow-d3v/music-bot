import { Telegraf, Markup } from "telegraf";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// 👑 ادمین
const ADMIN_ID = Number(process.env.ADMIN_ID);

// 📢 کانال اجباری
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME;

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

        return ["member", "administrator", "creator", "restricted"].includes(res.status);

    } catch (err) {
        console.log("member check error:", err.message);
        return false;
    }
}

// ---------- DB helper ----------
function getDB() {
    return loadDB().slice().reverse();
}

// ---------- KEYBOARD ----------
function getKeyboard(page = 0) {
    const db = loadDB(); // بدون reverse

    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    const reversed = db.slice().reverse(); // فقط برای نمایش

    const items = reversed.slice(start, end);

    const buttons = [];

    for (let i = 0; i < items.length; i++) {

        // تبدیل index درست به DB اصلی
        const realIndex = db.length - 1 - (start + i);

        buttons.push([
            Markup.button.callback(items[i].title, `song_${realIndex}`)
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

    if (!(await isMember(ctx.from.id))) {
        return ctx.reply(
            `⚠️ برای استفاده از ربات باید عضو کانال باشید:\n\n👉 ${CHANNEL_USERNAME}`,
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

    await ctx.replyWithPhoto(
        "https://t.me/PainxSorrow/455",
        {
            caption: `🎵 خوش آمدی!\n\n👇 از لیست زیر آهنگ انتخاب کن`
        }
    );

    await ctx.reply("🎵 لیست آهنگ‌ها", getKeyboard(0));
});

// ---------- CHECK ----------
bot.action("check", async (ctx) => {
    if (!(await isMember(ctx.from.id))) {
        return ctx.answerCbQuery("❌ هنوز عضو نیستی");
    }

    await ctx.editMessageText(
        "🎵 خوش آمدی!\n\n👇 لیست آهنگ‌ها",
        getKeyboard(0)
    );

    ctx.answerCbQuery("✅ تایید شد");
});

// ---------- HELP ----------
bot.command("help", async (ctx) => {
    if (!(await isMember(ctx.from.id)))
        return ctx.reply("⚠️ اول عضو کانال شو");

    ctx.reply(`📌 راهنما:\n\n🎵 انتخاب آهنگ\n🎲 آهنگ شانسی`);
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

    const fileId =
        msg.audio?.file_id ||
        msg.document?.file_id ||
        msg.voice?.file_id ||
        msg.video?.file_id ||
        msg.video_note?.file_id;

    const title =
        msg.caption ||
        msg.audio?.title ||
        msg.document?.file_name ||
        (msg.voice ? "🎤 ویس" : "🎵 بدون عنوان");

    const db = loadDB();

    db.unshift({
        title,
        fileId
    });

    saveDB(db);

    ctx.reply("👌 آهنگ ذخیره شد");
});

// ---------- PLAY SONG ----------
bot.action(/^song_(\d+)$/, async (ctx) => {

    if (!(await isMember(ctx.from.id)))
        return ctx.answerCbQuery("❌ عضو نیستی");

    const db = getDB();
    const song = db[Number(ctx.match[1])];

    if (!song) return ctx.answerCbQuery("یافت نشد");

    await ctx.telegram.sendDocument(
        ctx.chat.id,
        song.fileId
    );

    ctx.answerCbQuery();
});

// ---------- RANDOM ----------
bot.action("random", async (ctx) => {

    if (!(await isMember(ctx.from.id)))
        return ctx.answerCbQuery("❌ عضو نیستی");

    const db = loadDB();
    if (!db.length) return ctx.answerCbQuery("خالیه");

    const song = db[Math.floor(Math.random() * db.length)];

    await ctx.telegram.sendDocument(
        ctx.chat.id,
        song.fileId
    );

    ctx.answerCbQuery("🎲");
});

// ---------- PAGINATION ----------
bot.action(/^page_(\d+)$/, async (ctx) => {

    if (!(await isMember(ctx.from.id)))
        return ctx.answerCbQuery("❌ عضو نیستی");

    const page = Number(ctx.match[1]);

    await ctx.editMessageReplyMarkup(
        getKeyboard(page).reply_markup
    );

    ctx.answerCbQuery();
});

// ---------- ERROR ----------
bot.catch(console.error);

bot.launch();

console.log("✅ Music Bot Running (FINAL VERSION)");
