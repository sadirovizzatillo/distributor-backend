// telegram/telegram.bot.ts
import TelegramBot from 'node-telegram-bot-api';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ShopsService } from "../shops/shops.service";

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private bot: TelegramBot;

  constructor(
    private readonly shopsService: ShopsService,
  ) {}

  // Start bot when module initializes
  onModuleInit() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
      polling: true,
      autoStart: true,
      params: {
        timeout: 10
      }
    });

    console.log('✅ Telegram bot started');
    this.registerHandlers();
  }

  // Clean up when app shuts down
  onModuleDestroy() {
    this.bot.stopPolling();
    console.log('🛑 Telegram bot stopped');
  }

  // Register all bot command handlers
  private registerHandlers() {
    // Handler: /start shop_123
    this.bot.onText(/\/start shop_(.+)/, async (msg, match) => {
      await this.handleShopConnection(msg, match[1]);
    });

    // Handler: /start (no parameter)
    this.bot.onText(/\/start$/, async (msg) => {
      await this.handleStart(msg);
    });

    // Handler: /help
    this.bot.onText(/\/help/, async (msg) => {
      await this.handleHelp(msg);
    });

    // Handler: /status (check connection status)
    this.bot.onText(/\/status/, async (msg) => {
      await this.handleStatus(msg);
    });

    // Catch all other messages
    this.bot.on('message', async (msg) => {
      // Ignore if it's a command (already handled above)
      if (msg.text?.startsWith('/')) return;

      await this.handleUnknownMessage(msg);
    });
  }

  // Handle shop connection: /start shop_123
  private async handleShopConnection(msg: TelegramBot.Message, shopId: string) {
    const chatId = msg.chat.id;

    try {
      // Find shop
      const shop = await this.shopsService.findOne(Number(shopId));

      if (!shop) {
        return this.bot.sendMessage(chatId, '❌ Shop not found. Please check the link.');
      }

      // Check if already connected to another account
      if (shop.chatId && shop.chatId !== chatId.toString()) {
        return this.bot.sendMessage(
          chatId,
          '⚠️ This shop is already connected to another Telegram account.\n\nIf this is an error, please contact support.'
        );
      }

      // Check if already connected to this account
      if (shop.chatId === chatId.toString()) {
        return this.bot.sendMessage(
          chatId,
          `✅ You are already connected to shop: ${shop.name}\n\nYou will receive order notifications here.`
        );
      }

      // Connect shop to this chat
      await this.shopsService.updateChatId(shopId, chatId.toString());

      this.bot.sendMessage(
        chatId,
        `🎉 Successfully connected!\n\n` +
          `Shop: ${shop.name}\n` +
          `You will now receive order notifications here.\n\n` +
          `Commands:\n` +
          `/status - Check connection\n` +
          `/help - Show help`
      );
    } catch (error) {
      console.error("Error connecting shop:", error);
      this.bot.sendMessage(
        chatId,
        "❌ An error occurred. Please try again later."
      );
    }
  }

  // Handle: /start
  private async handleStart(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const userName = msg.from?.first_name || 'there';

    this.bot.sendMessage(
      chatId,
      `👋 Hello ${userName}!\n\n` +
      `This is the Order Notification Bot.\n\n` +
      `To connect your shop:\n` +
      `1. Get your connection link from the admin panel\n` +
      `2. Click the link to connect\n\n` +
      `Need help? Send /help`
    );
  }

  // Handle: /help
  private async handleHelp(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;

    this.bot.sendMessage(
      chatId,
      `📚 Help\n\n` +
      `Commands:\n` +
      `/start - Start the bot\n` +
      `/status - Check your connection status\n` +
      `/help - Show this help message\n\n` +
      `Questions? Contact support.`
    );
  }

  // Handle: /status
  private async handleStatus(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;

    try {
      // Find shop by chatId
      const shop = await this.shopsService.findByChatId(chatId.toString());

      if (shop) {
        this.bot.sendMessage(
          chatId,
          `✅ Connected\n\n` +
          `Shop: ${shop.name}\n` +
          `Status: Active\n\n` +
          `You will receive order notifications here.`
        );
      } else {
        this.bot.sendMessage(
          chatId,
          `⚠️ Not connected to any shop.\n\n` +
          `Please use the connection link from your admin panel.`
        );
      }
    } catch (error) {
      console.error('Error checking status:', error);
      this.bot.sendMessage(chatId, '❌ Error checking status.');
    }
  }

  // Handle unknown messages
  private async handleUnknownMessage(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;

    this.bot.sendMessage(
      chatId,
      `I don't understand that message. 🤔\n\nSend /help to see available commands.`
    );
  }

  // Public method: Send order notification
  async sendOrderNotification(chatId: string, orderData: any) {
    console.log(orderData);
    try {
      // Build products list
      let productsText = '';
      let itemCount = 0;

      if (orderData.items && orderData.items.length > 0) {
        productsText = orderData.items.map((item: any, index: number) => {
          itemCount += Number(item.quantity);
          const subtotal = Number(item.quantity) * Number(item.price);

          return (
            `${index + 1}. *${item.product.name}*\n` +
            `   ${item.quantity} dona × ${Number(item.price).toLocaleString()} = ${subtotal.toLocaleString()} so'm`
          );
        }).join('\n\n');
      }

      const message =
        `🔔 *Yangi buyurtma yaratildi!*\n\n` +
        `📋 Buyurtma raqami #${orderData.id}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👤 Xodim: ${orderData.user.name}\n` +
        `📞 Tel: ${orderData.user.phone}\n\n` +
        `📦 Mahsulotlar (${itemCount} dona):\n` +
        `${productsText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *Jami: ${Number(orderData.totalPrice).toLocaleString()} so'm*\n` +
        `💳 To'landi: ${(Number(orderData.totalPrice) - Number(orderData.remainingAmount)).toLocaleString()} so'm\n` +
        `📊 Qoldi: ${Number(orderData.remainingAmount).toLocaleString()} so'm\n` +
        `📦 Holati: ${orderData.status}\n\n` +
        `⏰ Mahsulot tez orada yetkaziladi!`;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });

      console.log(`✅ Notification sent to chatId: ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to send notification to ${chatId}:`, error);
      // Don't throw - order should still be created even if notification fails
    }
  }

  async sendDeliveryNotification(chatId: string, orderData: any) {
    console.log(orderData);
    try {
      // Build products list
      let productsText = '';
      let itemCount = 0;

      if (orderData.items && orderData.items.length > 0) {
        productsText = orderData.items
          .map((item: any, index: number) => {
            itemCount += Number(item.quantity);
            const subtotal = Number(item.quantity) * Number(item.price);

            return (
              `${index + 1}. *${item.product.name}*\n` +
              `   ${item.quantity} dona × ${Number(item.price).toLocaleString()} = ${subtotal.toLocaleString()} so'm`
            );
          })
          .join('\n\n');
      }

      const message =
        `✅ *Buyurtma yetkazib berildi!*\n\n` +
        `📋 Buyurtma raqami #${orderData.id}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👤 Xodim: ${orderData.user.name}\n` +
        `📞 Tel: ${orderData.user.phone}\n\n` +
        `📦 Mahsulotlar (${itemCount} dona):\n` +
        `${productsText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *Zakaz summasi: ${Number(orderData.totalPrice).toLocaleString()} so'm*\n` +
        `📊 Jami qarzi: ${Number(orderData.remainingAmount).toLocaleString()} so'm\n\n` +
        `🚚 Buyurtma muvaffaqiyatli yetkazildi! ✅`;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
      });

      console.log(`✅ Delivery notification sent to chatId: ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to send delivery notification to ${chatId}:`, error);
      // Don't throw - status update should complete even if notification fails
    }
  }

  async sendPaymentNotification(chatId: string, paymentData: any) {
    try {
      // Format date
      const paymentDate = new Date(paymentData.payment.createdAt);
      const formattedDate = new Intl.DateTimeFormat('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(paymentDate);

      // Build message
      let message =
        `🧾 *TO'LOV TO'LANDI*\n\n` +
        `📋 To'lov raqami: #${paymentData.payment.id}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👤 Distribyuter: ${paymentData.user.name}\n` +
        `📞 Tel: ${paymentData.user.phone}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 To'langan summa: ${Number(paymentData.payment.amount).toLocaleString()} so'm\n` +
        `💳 To'lov turi: ${paymentData.payment.paymentMethod}\n\n` +
        `📊 Avvalgi qarz: ${Number(paymentData.previousDebt).toLocaleString()} so'm\n`;

      // Add debt status
      if (paymentData.newDebt > 0) {
        message += `📉 Qoldiq qarz: ${Number(paymentData.newDebt).toLocaleString()} so'm \n`;
      } else {
        message += `✅ Qarz to'liq to'landi!\n`;
      }

      // Add notes if present
      if (paymentData.payment.notes && paymentData.payment.notes.trim()) {
        message += `\n📝 Izoh: ${paymentData.payment.notes}\n`;
      }

      // Add date
      message += `\n📅 Sana: ${formattedDate}`;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
      });

      console.log(`✅ Payment notification sent to chatId: ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to send payment notification to ${chatId}:`, error);
      // Don't throw - payment should complete even if notification fails
    }
  }

  async sendManualDebtNotification(chatId: string, debtData: any) {
    console.log(debtData);
    try {
      // Format date
      const debtDate = new Date(debtData.debtRecord.createdAt);
      const formattedDate = new Intl.DateTimeFormat('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(debtDate);

      // Build message
      let message =
        `📊 *ESKI QARZ QO'SHILDI*\n\n` +
        `📋 Yozuv raqami: #${debtData.debtRecord.id}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👤 Distribyuter: ${debtData.user.name}\n` +
        `📞 Tel: ${debtData.user.phone}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `➕ Qo'shildi: ${Number(debtData.addedAmount).toLocaleString()} so'm\n\n` +
        `📊 Avvalgi qarz: ${Number(debtData.previousDebt).toLocaleString()} so'm\n` +
        `💰 Jami qarz: ${Number(debtData.newDebt).toLocaleString()} so'm\n`;

      // Add notes if present
      if (debtData.debtRecord.notes && debtData.debtRecord.notes.trim()) {
        message += `\n📝 Izoh: ${debtData.debtRecord.notes}\n`;
      }

      // Add date
      message += `\n📅 Sana: ${formattedDate}`;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
      });

      console.log(`✅ Manual debt notification sent to chatId: ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to send manual debt notification to ${chatId}:`, error);
      // Don't throw - debt should be added even if notification fails
    }
  }

  // Public method: Send custom message
  async sendMessage(chatId: string, text: string) {
    try {
      await this.bot.sendMessage(chatId, text);
    } catch (error) {
      console.error(`Failed to send message to ${chatId}:`, error);
    }
  }
}