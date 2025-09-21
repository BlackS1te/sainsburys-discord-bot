const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    EmbedBuilder,
} = require("discord.js");

// Bot configuration
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Required role name
const REQUIRED_ROLE = "Paid Sainsburys";

// Function to check if user has required role
function hasRequiredRole(member) {
    return member.roles.cache.some((role) => role.name === REQUIRED_ROLE);
}

// Utility functions
function padLeft(str, length) {
    return str.toString().padStart(length, "0");
}

function calculateCheckDigit(input) {
    let sum = 0;
    for (let i = 0; i < input.length; i++) {
        const digit = parseInt(input[input.length - 1 - i], 10);
        const weight = i % 2 === 0 ? 3 : 1;
        sum += digit * weight;
    }
    return (10 - (sum % 10)) % 10;
}

function generateBarcodeData(productCode, priceInPence) {
    try {
        // Validate inputs
        if (!productCode || productCode.length < 8) {
            throw new Error("Barcode must be at least 8 digits long");
        }

        if (priceInPence < 1 || priceInPence > 99999) {
            throw new Error("Price must be between 1p and £999.99");
        }

        // Process barcode
        const numericProduct = productCode.replace(/\D/g, "");
        let productDigits =
            numericProduct.length === 14
                ? numericProduct.slice(0, -1)
                : numericProduct;
        productDigits = padLeft(productDigits, 13);

        const paddedPrice = padLeft(priceInPence, 6);
        const baseNumber = `91${productDigits}${paddedPrice}`;
        const checkDigit = calculateCheckDigit(baseNumber);
        const fullBarcode = `${baseNumber}${checkDigit}`;

        // Generate barcode image URL using free API with minimal white background
        const barcodeImageURL = `https://barcode.tec-it.com/barcode.ashx?data=${fullBarcode}&code=Code128&multiplebarcodes=false&translate-esc=false&unit=Fit&dpi=150&imagetype=Png&rotation=0&color=%23000000&bgcolor=%23ffffff&codepage=&qunit=Mm&quiet=5&eclevel=L&barwidth=2&barheight=50`;

        return {
            barcode: fullBarcode,
            price: priceInPence,
            imageURL: barcodeImageURL,
        };
    } catch (error) {
        throw error;
    }
}

// Slash command registration
const commands = [
    new SlashCommandBuilder()
        .setName("barcode")
        .setDescription("Generate a Sainsbury's style barcode")
        .addStringOption((option) =>
            option
                .setName("item_name")
                .setDescription("Name of the item")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("product_code")
                .setDescription("Product barcode (8-13 digits)")
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName("price")
                .setDescription("Price in pence (e.g., 100 for £1.00)")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(99999),
        ),

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show help information for the barcode bot"),
];

// Bot ready event
client.once("clientReady", async () => {
    console.log(`🤖 Sainsbury's Barcode Bot is online as ${client.user.tag}!`);

    // Register slash commands
    try {
        console.log("Started refreshing application (/) commands.");
        await client.application.commands.set(commands);
        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error("Error registering commands:", error);
    }

    // Set bot status
    client.user.setActivity("Generating barcodes | /barcode", {
        type: "PLAYING",
    });
});

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    try {
        // Check if user has required role (skip check for help command)
        if (commandName !== "help") {
            const member = interaction.member;

            if (!member || !hasRequiredRole(member)) {
                const noPermissionEmbed = new EmbedBuilder()
                    .setTitle("🔒 Access Denied")
                    .setDescription(
                        `**You need the "${REQUIRED_ROLE}" role to use this bot!**\n\nContact a server administrator to get access.`,
                    )
                    .setColor(0xdc3545)
                    .setFooter({
                        text: "Sainsbury's Barcode Generator",
                        iconURL: client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

                await interaction.reply({
                    embeds: [noPermissionEmbed],
                    ephemeral: true,
                });
                return;
            }
        }

        if (commandName === "barcode") {
            await interaction.deferReply();

            const itemName = options.getString("item_name");
            const productCode = options.getString("product_code");
            const price = options.getInteger("price");

            const result = generateBarcodeData(productCode, price);

            const priceFormatted = (price / 100).toLocaleString("en-GB", {
                style: "currency",
                currency: "GBP",
            });

            const embed = new EmbedBuilder()
                .setTitle("🏷️ Sainsbury's Barcode Generator")
                .setDescription(`**Generated By Blacksite!**`)
                .addFields(
                    { name: "Item Name", value: `${itemName}`, inline: true },
                    {
                        name: "Product Code",
                        value: `\`${productCode}\``,
                        inline: true,
                    },
                    { name: "Price", value: priceFormatted, inline: true },
                )
                .setColor(0xf47738)
                .setFooter({
                    text: "Sainsbury's Barcode Generator",
                    iconURL: client.user.displayAvatarURL(),
                })
                .setTimestamp()
                .setImage(result.imageURL);

            await interaction.editReply({ embeds: [embed] });

        } else if (commandName === "help") {
            const embed = new EmbedBuilder()
                .setTitle("🤖 Sainsbury's Barcode Bot Help")
                .setDescription(
                    "Generate Sainsbury's style barcodes with custom pricing!",
                )
                .addFields(
                    {
                        name: "🔒 Access Required",
                        value: `You need the **"${REQUIRED_ROLE}"** role to use barcode generation commands.`,
                        inline: false,
                    },
                    {
                        name: "📋 Commands",
                        value: "`/barcode` - Generate custom barcode\n`/help` - Show this help message",
                        inline: false,
                    },
                    {
                        name: "🏷️ /barcode",
                        value: "Generate a barcode with item name and custom price\n**Usage:** `/barcode item_name:Coca Cola product_code:1234567890123 price:100`",
                        inline: false,
                    },
                    {
                        name: "📝 Notes",
                        value: "• Item name is required\n• Product code must be 8-13 digits\n• Price in pence (100 = £1.00)\n• Max price: £999.99\n• Only users with \"Paid Sainsburys\" role can generate barcodes",
                        inline: false,
                    },
                )
                .setColor(0xdc3545)
                .setFooter({
                    text: "Sainsbury's Barcode Generator • Discord Bot",
                    iconURL: client.user.displayAvatarURL(),
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    } catch (error) {
        console.error("Command error:", error);

        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(`**Error:** ${error.message}`)
            .setColor(0xdc3545)
            .setFooter({ text: "Sainsbury's Barcode Generator" })
            .setTimestamp();

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
});

// Error handling
client.on("error", console.error);

process.on("unhandledRejection", (reason, promise) => {
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
});

// Keep-alive server for Replit
const express = require("express");
const app = express();

app.get("/", (req, res) => {
    res.send("Sainsbury's Discord Bot is running!");
});

app.listen(3000, () => {
    console.log("Keep-alive server started on port 3000");
});

// Login with token from environment variable
client.login(process.env.DISCORD_TOKEN);
