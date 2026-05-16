const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const express = require('express');
const app = express();
const https = require('https');
const fs = require('fs');
const path = require('path');

// Mở port cho Render không bị sập (Render dùng port động qua process.env.PORT)
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Vexz Hub Bot is online 24/7!'));
app.listen(PORT, () => console.log(`💻 Web server đang chạy trên port ${PORT}`));

// ===== CONFIG =====
const OWNER_ID = "1486380909736366120"; // ← ÔNG ĐỔI ID DISCORD CỦA ÔNG VÀO ĐÂY
const TOKEN = process.env.TOKEN; // Đã sửa thành TOKEN viết hoa theo Render

// ===== DATABASE =====
// Sửa đường dẫn lưu file vào thư mục tạm hoặc thư mục gốc của Render bám theo dự án
const DB_PATH = path.join(__dirname, 'database.json');
let database = { keys: {}, whitelist: [] };

try {
    if (fs.existsSync(DB_PATH)) {
        database = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        console.log(`✅ Loaded thành công: ${Object.keys(database.keys).length} keys từ database.`);
    }
} catch(e) {
    console.log("⚠️ Không thể đọc file database, đang khởi tạo mới.");
}

function saveDatabase() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
    } catch (e) {
        console.log("⚠️ Lỗi lưu file database:", e.message);
    }
}
setInterval(saveDatabase, 30000);

// ===== TẠO KEY NGẪU NHIÊN DÍNH LIỀN =====
function generateKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "";
    for (let i = 0; i < 25 + Math.floor(Math.random() * 11); i++) {
        key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key;
}

// ===== BOT DISCORD =====
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const slashCommands = [
    new SlashCommandBuilder().setName('help').setDescription('📋 Danh sách lệnh'),
    new SlashCommandBuilder().setName('ping').setDescription('🏓 Check ping'),
    new SlashCommandBuilder().setName('genkey').setDescription('🔑 Admin tạo key').addIntegerOption(o => o.setName('ngay').setDescription('Số ngày').setRequired(true)),
    new SlashCommandBuilder().setName('redeem').setDescription('🎫 Nhập key').addStringOption(o => o.setName('key').setDescription('Key').setRequired(true)),
    new SlashCommandBuilder().setName('script').setDescription('📜 Lấy script').addStringOption(o => o.setName('key').setDescription('Key (để trống nếu đã WL)').setRequired(false)),
    new SlashCommandBuilder().setName('whitelist').setDescription('✅ Whitelist user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('unwhitelist').setDescription('❌ Gỡ whitelist').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('mykey').setDescription('🔍 Kiểm tra key'),
    new SlashCommandBuilder().setName('listkeys').setDescription('📜 Danh sách key'),
    new SlashCommandBuilder().setName('deletekey').setDescription('🗑️ Xóa key').addStringOption(o => o.setName('key').setDescription('Key').setRequired(true)),
];

client.on('ready', async () => {
    console.log(`✅ ${client.user.tag} đã online thành công trên Render!`);
    client.user.setActivity('/help | Vexz Hub 24/7', { type: 3 }); // Kiểu hiển thị WATCHING

    try {
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ Đã đăng ký thành công Slash Commands hệ thống!');
    } catch (error) {
        console.error('⚠️ Lỗi đăng ký lệnh slash:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, user } = interaction;
    const userId = user.id;
    const userName = user.username;

    // ===== /help (CÔNG KHAI) =====
    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle("🤖 VEXZ HUB - WHITELIST BOT")
            .setColor(0x00ff00)
            .addFields(
                { name: "🔹 /genkey <ngày>", value: "Admin tạo key mới" },
                { name: "🔹 /redeem <key>", value: "Nhập key để kích hoạt whitelist" },
                { name: "🔹 /script [key]", value: "Lấy đoạn mã script chạy trong game" },
                { name: "🔹 /mykey", value: "Kiểm tra thông tin key cá nhân" },
                { name: "🔹 /ping", value: "Kiểm tra trạng thái phản hồi của Bot" }
            )
            .setFooter({ text: "🟢 Hệ thống tự động hoạt động 24/7" });
        await interaction.reply({ embeds: [embed] });
    }

    // ===== /ping (CÔNG KHAI) =====
    if (commandName === 'ping') {
        const u = process.uptime();
        await interaction.reply(`🏓 **${client.ws.ping}ms** | Thời gian chạy liên tục: ${Math.floor(u/3600)}h ${Math.floor(u%3600/60)}m`);
    }

    // ===== /genkey (ADMIN ONLY - ẨN DANH) =====
    if (commandName === 'genkey') {
        if (userId !== OWNER_ID) return interaction.reply({ content: "❌ Ông không có quyền sử dụng lệnh của Admin!", ephemeral: true });
        
        const days = interaction.options.getInteger('ngay');
        const newKey = generateKey();
        database.keys[newKey] = {
            expiry: new Date(Date.now() + days * 86400000).toISOString(),
            username: null, 
            userId: null,
            createdAt: new Date().toISOString()
        };
        saveDatabase();
        
        const embed = new EmbedBuilder()
            .setTitle("✅ TẠO KEY THÀNH CÔNG")
            .setColor(0x00ff00)
            .addFields(
                { name: "🔑 Mã Key (Nhấp để copy)", value: `\`${newKey}\`` },
                { name: "📅 Thời hạn sử dụng", value: `${days} ngày` }
            );
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ===== /redeem (ẨN DANH) =====
    if (commandName === 'redeem') {
        const key = interaction.options.getString('key');
        
        if (database.whitelist.includes(userId)) {
            return interaction.reply({ content: "❌ Ông đã nằm trong danh sách Whitelist từ trước rồi!", ephemeral: true });
        }
        if (!database.keys[key]) {
            return interaction.reply({ content: "❌ Mã Key này không tồn tại hoặc đã bị xóa khỏi hệ thống!", ephemeral: true });
        }
        if (new Date() > new Date(database.keys[key].expiry)) {
            delete database.keys[key]; saveDatabase();
            return interaction.reply({ content: "❌ Key này đã hết hạn sử dụng!", ephemeral: true });
        }
        if (database.keys[key].userId && database.keys[key].userId !== userId) {
            return interaction.reply({ content: "❌ Key này đã được kích hoạt bởi một tài khoản khác!", ephemeral: true });
        }
        
        database.keys[key].username = userName;
        database.keys[key].userId = userId;
        database.whitelist.push(userId);
        saveDatabase();
        
        await interaction.reply({ content: "✅ **Kích hoạt thành công!** Hãy dùng lệnh `/script` để lấy mã chạy game nha.", ephemeral: true });
    }

    // ===== /script (ẨN DANH) =====
    if (commandName === 'script') {
        let userKey = interaction.options.getString('key');
        
        if (!userKey) {
            if (!database.whitelist.includes(userId)) {
                return interaction.reply({ content: "❌ Ông chưa được Whitelist! Hãy dùng lệnh `/redeem` trước.", ephemeral: true });
            }
            for (const [k, v] of Object.entries(database.keys)) {
                if (v.userId === userId) { userKey = k; break; }
            }
        }
        
        if (!database.keys[userKey]) return interaction.reply({ content: "❌ Không tìm thấy Key tương ứng với tài khoản!", ephemeral: true });
        if (new Date() > new Date(database.keys[userKey].expiry)) {
            delete database.keys[userKey]; saveDatabase();
            return interaction.reply({ content: "❌ Key liên kết với tài khoản này đã hết hạn!", ephemeral: true });
        }
        
        // Đoạn script chính của Vexz Hub
        const script = `repeat wait() until game:IsLoaded() and game.Players.LocalPlayer\ngetgenv().Key = "${userKey}"\nloadstring(game:HttpGet("https://raw.githubusercontent.com/phamquochoa1942-png/DevVexzHub/refs/heads/main/VexzHub"))()`;
        
        await interaction.reply({
            content: `📜 **Mã Script Vexz Hub của ông:**\n\`\`\`lua\n${script}\n\`\`\``,
            ephemeral: true
        });
    }

    // ===== /whitelist (ADMIN ONLY) =====
    if (commandName === 'whitelist') {
        if (userId !== OWNER_ID) return interaction.reply({ content: "❌ Quyền lực từ chối!", ephemeral: true });
        const target = interaction.options.getUser('user');
        if (database.whitelist.includes(target.id)) return interaction.reply({ content: "⚠️ Người chơi này đã có trong Whitelist rồi!", ephemeral: true });
        
        database.whitelist.push(target.id); saveDatabase();
        await interaction.reply({ content: `✅ Đã cấp Whitelist trực tiếp cho thành viên **${target.username}**`, ephemeral: true });
    }

    // ===== /unwhitelist (ADMIN ONLY) =====
    if (commandName === 'unwhitelist') {
        if (userId !== OWNER_ID) return interaction.reply({ content: "❌ Quyền lực từ chối!", ephemeral: true });
        const target = interaction.options.getUser('user');
        const idx = database.whitelist.indexOf(target.id);
        if (idx === -1) return interaction.reply({ content: "⚠️ Thành viên này không nằm trong danh sách Whitelist!", ephemeral: true });
        
        database.whitelist.splice(idx, 1);
        for (const [k, v] of Object.entries(database.keys)) {
            if (v.userId === target.id) delete database.keys[k];
        }
        saveDatabase();
        await interaction.reply({ content: `✅ Đã gỡ Whitelist và hủy bỏ toàn bộ Key của thành viên **${target.username}**`, ephemeral: true });
    }

    // ===== /mykey (ẨN DANH) =====
    if (commandName === 'mykey') {
        if (!database.whitelist.includes(userId)) return interaction.reply({ content: "❌ Ông chưa kích hoạt Whitelist nên không có dữ liệu Key!", ephemeral: true });
        let found = null;
        for (const [k, v] of Object.entries(database.keys)) {
            if (v.userId === userId) { found = { key: k, ...v }; break; }
        }
        if (found) {
            await interaction.reply({
                content: `🔑 **Thông tin Key của ông:**\n• Mã Key: \`${found.key}\`\n• Hạn dùng đến: ${new Date(found.expiry).toLocaleDateString("vi-VN")}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({ content: "⚠️ Tài khoản được WL trực tiếp bằng lệnh Admin nên không đi kèm mã Key.", ephemeral: true });
        }
    }

    // ===== /listkeys (ADMIN ONLY - ẨN DANH) =====
    if (commandName === 'listkeys') {
        if (userId !== OWNER_ID) return interaction.reply({ content: "❌ Quyền lực từ chối!", ephemeral: true });
        const list = Object.entries(database.keys).slice(0, 25).map(([k, v]) => 
            `\`${k.slice(0,12)}...\` | Người dùng: ${v.username || 'Chưa dùng'} | Hạn: ${new Date(v.expiry).toLocaleDateString("vi-VN")}`
        ).join('\n') || 'Hệ thống hiện tại chưa có mã Key nào.';
        await interaction.reply({ content: `📜 **Danh sách 25 Key gần nhất:**\n${list}`, ephemeral: true });
    }

    // ===== /deletekey (ADMIN ONLY - ẨN DANH) =====
    if (commandName === 'deletekey') {
        if (userId !== OWNER_ID) return interaction.reply({ content: "❌ Quyền lực từ chối!", ephemeral: true });
        const key = interaction.options.getString('key');
        if (!database.keys[key]) return interaction.reply({ content: "❌ Không tìm thấy mã Key này trên hệ thống!", ephemeral: true });
        
        if (database.keys[key].userId) {
            const idx = database.whitelist.indexOf(database.keys[key].userId);
            if (idx !== -1) database.whitelist.splice(idx, 1);
        }
        delete database.keys[key]; saveDatabase();
        await interaction.reply({ content: `✅ Đã xóa bỏ hoàn toàn mã Key \`${key}\` ra khỏi hệ thống.`, ephemeral: true });
    }
});

client.login(TOKEN);
 
