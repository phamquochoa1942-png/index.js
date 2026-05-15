const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const app = express();

// ===== CẤU HÌNH (THAY THÔNG TIN CỦA ÔNG VÀO ĐÂY) =====
const OWNER_ID = "1486380909736366120"; 
const TOKEN = process.env['TOKEN'];
const MONGO_URI = "mongodb+srv://VexzhubAdminByQuochoa:Quochoa2382012@cluster0.lk2gk5w.mongodb.net/?appName=Cluster0";

// ===== KẾT NỐI DATABASE =====
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Đã thông suốt với MongoDB Atlas!"))
    .catch(err => console.error("❌ Lỗi MongoDB:", err));

const KeySchema = new mongoose.Schema({
    keyText: String,
    userId: String,
    username: String,
    hwid: { type: String, default: "" },
    ip: { type: String, default: "" },
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now }
});
const Key = mongoose.model('VexzKeys', KeySchema);

// ===== WEB API CHO ROBLOX CHECK KEY =====
app.get('/', (req, res) => res.send('Vexz Hub System is Online!'));

app.get('/verify', async (req, res) => {
    const { key, hwid } = req.query;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const data = await Key.findOne({ keyText: key });

    if (!data) return res.send("invalid"); // Key không tồn tại
    if (new Date() > data.expiresAt) return res.send("expired"); // Hết hạn

    // Quản lý HWID
    if (data.hwid === "") {
        data.hwid = hwid;
        data.ip = userIP;
        await data.save();
        return res.send("success");
    }

    if (data.hwid === hwid) {
        data.ip = userIP; // Cập nhật IP mới nhất
        await data.save();
        return res.send("success");
    } else {
        return res.send("wrong_hwid"); // Sai mã máy
    }
});

app.listen(3000, () => console.log("🌐 Web API đang chạy tại Port 3000"));

// ===== BOT DISCORD =====
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const commands = [
    new SlashCommandBuilder().setName('genkey').setDescription('Tạo key mới (Admin)')
        .addIntegerOption(opt => opt.setName('days').setDescription('Số ngày').setRequired(true)),
    new SlashCommandBuilder().setName('redeem').setDescription('Nhập key để kích hoạt')
        .addStringOption(opt => opt.setName('key').setDescription('Nhập mã key').setRequired(true)),
    new SlashCommandBuilder().setName('check').setDescription('Kiểm tra thông tin key')
        .addStringOption(opt => opt.setName('key').setDescription('Key cần check').setRequired(true)),
];

client.on('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`🤖 Bot ${client.user.tag} đã sẵn sàng!`);
});

client.on('interactionCreate', async (inter) => {
    if (!inter.isChatInputCommand()) return;

    if (inter.commandName === 'genkey') {
        if (inter.user.id !== OWNER_ID) return inter.reply({ content: "❌ Cút! Bạn không phải Admin.", ephemeral: true });
        
        const days = inter.options.getInteger('days');
        const keyGenerated = "VEXZ-" + Math.random().toString(36).substring(2, 12).toUpperCase();
        const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        await Key.create({ keyText: keyGenerated, expiresAt: expiryDate });

        const embed = new EmbedBuilder()
            .setTitle("✅ TẠO KEY THÀNH CÔNG")
            .setColor(0x00FF00)
            .addFields(
                { name: "🔑 Key", value: `\`${keyGenerated}\`` },
                { name: "⏳ Hạn dùng", value: `${days} ngày` },
                { name: "📅 Hết hạn", value: expiryDate.toLocaleDateString("vi-VN") }
            );
        return inter.reply({ embeds: [embed] });
    }

    if (inter.commandName === 'redeem') {
        const keyInput = inter.options.getString('key');
        const found = await Key.findOne({ keyText: keyInput });

        if (!found) return inter.reply({ content: "❌ Key này không tồn tại!", ephemeral: true });
        if (found.userId) return inter.reply({ content: "❌ Key này đã có người dùng rồi!", ephemeral: true });

        found.userId = inter.user.id;
        found.username = inter.user.username;
        await found.save();

        return inter.reply({ content: `✅ Chúc mừng **${inter.user.username}**! Bạn đã kích hoạt thành công Vexz Hub.`, ephemeral: true });
    }

    if (inter.commandName === 'check') {
        const keyInput = inter.options.getString('key');
        const found = await Key.findOne({ keyText: keyInput });

        if (!found) return inter.reply({ content: "❌ Không tìm thấy thông tin.", ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle("🔍 THÔNG TIN KEY")
            .addFields(
                { name: "Người dùng", value: found.username || "Chưa có" },
                { name: "HWID", value: `\`${found.hwid || "Trống"}\`` },
                { name: "IP mới nhất", value: `\`${found.ip || "Trống"}\`` },
                { name: "Hạn dùng", value: found.expiresAt.toLocaleDateString("vi-VN") }
            );
        return inter.reply({ embeds: [embed], ephemeral: true });
    }
});

client.login(TOKEN);
