import { describe, expect, it, vi, beforeEach } from "vitest";
import { SmsOtpSender } from "@/infrastructure/auth/sms-otp-sender";

const sendSmsMock = vi.fn<(to: string, message: string) => Promise<void>>();

vi.mock("@/infrastructure/external/africastalking-client", () => ({
  sendSms: (to: string, message: string) => sendSmsMock(to, message),
}));

beforeEach(() => {
  sendSmsMock.mockReset().mockResolvedValue(undefined);
});

describe("SmsOtpSender", () => {
  it("envoie le message générique sans lien hors invitation vendeur", async () => {
    const sender = new SmsOtpSender();
    await sender.sendOtp("+221771234567", "123456");

    const [to, message] = sendSmsMock.mock.calls[0];
    expect(to).toBe("+221771234567");
    expect(message).toBe("Gestia — votre code de vérification : 123456 (valable 5 minutes)");
  });

  it("inclut le lien de première connexion quand isVendeurInvitation est vrai", async () => {
    const sender = new SmsOtpSender();
    await sender.sendOtp("+221771234567", "123456", { isVendeurInvitation: true });

    const [, message] = sendSmsMock.mock.calls[0];
    expect(message).toBe(
      "Gestia : code 123456. Definissez votre PIN : http://localhost:3000/premiere-connexion?phone=%2B221771234567",
    );
  });

  it("le message d'invitation reste en GSM-7 pur (pas de tiret cadratin ni d'accent) pour tenir en un seul segment SMS", async () => {
    const sender = new SmsOtpSender();
    await sender.sendOtp("+221771234567", "123456", { isVendeurInvitation: true });

    const [, message] = sendSmsMock.mock.calls[0];
    const isAsciiPrintable = [...message].every((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x20 && code <= 0x7e;
    });
    expect(isAsciiPrintable).toBe(true);
    expect(message.length).toBeLessThanOrEqual(160);
  });
});
