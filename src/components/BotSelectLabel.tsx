/** Bot 账号 Select：触发器只显示昵称，下拉显示「昵称（账号）」。 */
export default function BotSelectLabel({
  nickname,
  account,
}: {
  nickname?: string | null;
  account: string | number;
}) {
  const id = String(account).trim();
  const nick = String(nickname ?? "").trim();
  if (!nick) {
    return <span className="bot-sel-label">{id || "Bot"}</span>;
  }
  return (
    <span className="bot-sel-label">
      <span className="bot-sel-label__nick">{nick}</span>
      <span className="bot-sel-label__acct">（{id}）</span>
    </span>
  );
}
