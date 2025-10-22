const sendMessage = async (message: string) => {
    const encodedMessage = encodeURIComponent(message);
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${process.env.TELEGRAM_CHAT_ID}&text=${encodedMessage}`, {
        method: 'GET'
    });
    if (!response.ok) {
        throw new Error('Failed to send message to Telegram');
    }
    return response.json();
}

export default sendMessage;