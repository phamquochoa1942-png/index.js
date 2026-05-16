const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const express = require('express');
const app = express();
const mongoose = require('mongoose'); // Thêm mongoose để kết nối database

// Mở port cho Render
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Vexz Hub Bot MongoDB is online 24/7!'));
app.listen(PORT, () => console.log(`💻 Web server đang chạy trên port ${PORT}`));

// ===== CONFIG =====
const OWNER_ID = "1486380909736366120"; // ← THAY ID DISCORD CỦA ÔNG VÀO ĐÂY
const TOKEN = process.env.TOKEN;
const MONGO_URI = process.env.MONGO_URI; // Lấy link MongoDB từ bảng Env Render

// ===== KẾT NỐI MONGODB ATLAS =====
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Đã thông suốt với MongoDB Atlas vĩnh viễn!'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err.message));

// ===== ĐỊNH NGHĨA KHUNG DỮ LIỆU (SCHEMAS) =====
// Bảng lưu thông tin Key và Whitelist dính liền
const KeySchema = new mongoose.Schema({
    _id: String, // Đây chính là mã Key luôn
    expiry: String,
    username: String,
    userId: String,
    createdAt: String
});
const KeyModel = mongoose.model('Key', KeySchema, 'keys'); // Lưu vào bảng 'keys' giống database cũ của ông

const WhitelistSchema = new mongoose.Schema({
    _id: String // Lưu trữ userId đã được whitelist
});
const WhitelistModel = mongoose.model('Whitelist', WhitelistSchema, 'whitelists');

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
    client.user.setActivity('/help | Vexz Hub 24/7', { type: 3 });

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
            .setFooter({ text: "🟢 Hệ thống tự động lưu trữ vĩnh viễn trên MongoDB" });
        await interaction.reply({ embeds: [embed] });
    }

    // ===== /ping (CÔNG KHAI) =====
    if (commandName === 'ping') {
        const u = process.uptime();
        await interaction.reply(`🏓 **${client.ws.ping}ms** | Thời gian chạy liên tục: ${Math.floor(u/3600)}h ${Math.floor(u%3600/60)}m`);
    }

    // ===== /genkey (ADMIN ONLY - ẨN DANH) =====
    if (commandName === 'genkey') {
        if (userId !== OWNER_ID) return interaction.reply({ content: "❌  không có quyền sử dụng lệnh", ephemeral: true });
        
        const days = interaction.options.getInteger('ngay');
        const newKey = generateKey();
        const expiryDate = new Date(Date.now() + days * 86400000).toISOString();
        
        // Lưu trực tiếp vào MongoDB
        await KeyModel.create({
            _id: newKey,
            expiry: expiryDate,
            username: null,
            userId: null,
            createdAt: new Date().toISOString()
        });
        
        const embed = new EmbedBuilder()
            .setTitle("✅ TẠO KEY THÀNH CÔNG (ĐÃ LƯU DATABASE)")
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
        
        // Kiểm tra whitelist trên DB
        const isWhitelisted = await WhitelistModel.findById(userId);
        if (isWhitelisted) {
            return interaction.reply({ content: "❌ bạn đã nằm trong danh sách Whitelist từ trước rồi!", ephemeral: true });
        }

        // Tìm key trên DB
        const keyData = await KeyModel.findById(key);
        if (!keyData) {
            return interaction.reply({ content: "❌ Mã Key này không tồn tại hoặc đã bị xóa khỏi hệ thống!", ephemeral: true });
        }
        if (new Date() > new Date(keyData.expiry)) {
            await KeyModel.findByIdAndDelete(key);
            return interaction.reply({ content: "❌ Key này đã hết hạn sử dụng!", ephemeral: true });
        }
        if (keyData.userId && keyData.userId !== userId) {
            return interaction.reply({ content: "❌ Key này đã được kích hoạt bởi một tài khoản khác!", ephemeral: true });
        }
        
        // Cập nhật trạng thái Key và thêm vào Whitelist DB
        keyData.username = userName;
        keyData.userId = userId;
        await keyData.save();

        await WhitelistModel.create({ _id: userId });
        
        await interaction.reply({ content: "✅ **Kích hoạt thành công!** Hãy dùng lệnh `/script` để lấy mã chạy game nha.", ephemeral: true });
    }

    // ===== /script (ẨN DANH) =====
    if (commandName === 'script') {
        let userKey = interaction.options.getString('key');
        
        if (!userKey) {
            const isWhitelisted = await WhitelistModel.findById(userId);
            if (!isWhitelisted) {
                return interaction.reply({ content: "❌ bạn chưa được Whitelist! Hãy dùng lệnh `/redeem` trước.", ephemeral: true });
            }
            const foundKey = await KeyModel.findOne({ userId: userId });
            if (foundKey) userKey = foundKey._id;
        }
        
        const keyData = await KeyModel.findById(userKey);
        if (!keyData) return interaction.reply({ content: "❌ Không tìm thấy Key tương ứng với tài khoản!", ephemeral: true });
        if (new Date() > new Date(keyData.expiry)) {
            await KeyModel.findByIdAndDelete(userKey);
            await WhitelistModel.findByIdAndDelete(userId);
            return interaction.reply({ content: "❌ Key liên kết với tài khoản này đã hết hạn!", ephemeral: true });
        }
        
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
        
        const isWhitelisted = await WhitelistModel.findById(target.id);
        if (isWhitelisted) return interaction.reply({ content: "⚠️ Người chơi này đã có trong Whitelist rồi!", ephemeral: true });
        
        await WhitelistModel.create({ _id: target.id });
        await interaction.reply({ content: `✅ Đã cấp Whitelist trực tiếp cho thành viên **${target.username}**`, ephemeral: true });
    }

    // ===== /unwhitelist (ADMIN ONLY) =====
    if (commandName === 'unwhitelist') {
        if (userId !== OWNER_ID) return interaction.reply({ content: "❌ Quyền lực từ chối!", ephemeral: true });
        const target = interaction.options.getUser('user');
        
        const isWhitelisted = await WhitelistModel.findById(target.id);
        if (!isWhitelisted) return interaction.reply({ content: "⚠️ Thành viên này không nằm trong danh sách Whitelist!", ephemeral: true });
        
        await WhitelistModel.findByIdAndDelete(target.id);
        await KeyModel.deleteMany({ userId: target.id });
        await interaction.reply({ content: `✅ Đã gỡ Whitelist và hủy bỏ toàn bộ Key của thành viên **${target.username}**`, ephemeral: true });
    }

    // ===== /mykey (ẨN DANH) =====
    if (commandName === 'mykey') {
        const isWhitelisted = await WhitelistModel.findById(userId);
        if (!isWhitelisted) return interaction.reply({ content: "❌ bạn chưa kích hoạt Whitelist nên không có dữ liệu Key!", ephemeral: true });
        
        const found = await KeyModel.findOne({ userId: userId });
        if (found) {
            await interaction.reply({
                content: `🔑 **Thông tin Key của ông:**\n• Mã Key: \`${found._id}\`\n• Hạn dùng đến: ${new Date(found.expiry).toLocaleDateString("vi-VN")}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({ content: "⚠️ Tài khoản được WL trực tiếp bằng lệnh Admin nên không đi kèm mã Key.", ephemeral: true });
        }
    }

    // ===== /listkeys (ADMIN ONLY - ẨN DANH) =====
    if (commandName === 'listkeys') {
        if (userId !== OWNER_ID) return interaction.reply({ content: "❌ Quyền lực từ chối!", ephemeral: true });
        
        const allKeys = await KeyModel.find().limit(25);
        const list = allKeys.map(v => 
            `\`${v._id.slice(0,12)}...\` | Người dùng: ${v.username || 'Chưa dùng'} | Hạn: ${new Date(v.expiry).toLocaleDateString("vi-VN")}`
        ).join('\n') || 'Hệ thống hiện tại chưa có mã Key nào.';
        await interaction.reply({ content: `📜 **Danh sách 25 Key gần nhất:**\n${list}`, ephemeral: true });
    }

    // ===== /deletekey (ADMIN ONLY - ẨN DANH) =====
    if (commandName === 'deletekey') {
        if (userId !== OWNER_ID) return interaction.reply({ content: "❌ Quyền lực từ chối!", ephemeral: true });
        const key = interaction.options.getString('key');
        
        const keyData = await KeyModel.findById(key);
        if (!keyData) return interaction.reply({ content: "❌ Không tìm thấy mã Key này trên hệ thống!", ephemeral: true });
        
        if (keyData.userId) {
            await WhitelistModel.findByIdAndDelete(keyData.userId);
        }
        await KeyModel.findByIdAndDelete(key);
        await interaction.reply({ content: `✅ Đã xóa bỏ hoàn toàn mã Key \`${key}\` ra khỏi hệ thống.`, ephemeral: true });
    }
});

client.login(TOKEN);
 
