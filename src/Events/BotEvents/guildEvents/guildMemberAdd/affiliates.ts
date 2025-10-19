import * as Discord from 'discord.js';

export default async (member: RMember) => {
 switch (true) {
  case member.guild.id === '366219406776336385':
   gameverse(member);
   break;
  case member.guild.id === '390037305659883521':
   pockytime(member);
   break;
  case member.guild.id === '637683844988010546':
   reiko(member);
   break;
  default:
   break;
 }
};

const reiko = async (member: RMember) => {
 member.client.util.notificationThread(member, {
  content: `<:RC_Booster:976508507685814313> Check out our lovely Partners:

https://discord.gg/animekos?ref=reiko
https://discord.gg/twitch?ref=reiko
https://discord.gg/pocky?ref=reiko`,
 });
};

const pockytime = async (member: RMember) => {
 member.client.util.notificationThread(member, {
  content: `୨  Welcome! Here's some of our partnered discord servers <3

⠀    ୨  -  -  -  -  ︵ ︵ ︵
⠀ ⠀\`🍰\`┊[Bee's Nest ( !! HUGE VOUCH !! )]( https://discord.gg/honeybee )
⠀ ⠀\`🌸\`┊[X-Zone ( !! HUGE VOUCH !! )]( https://discord.gg/xzone )
⠀ ⠀\`🍰\`︰[Night Raid]( https://discord.gg/twitch?ref=pockytime )
⠀ ⠀\`🌸\`┊[Reiko's Cybercafe]( https://discord.gg/happy?ref=pockytime )
⠀ ⠀\`🍰\`︰[The TeaHouse]( https://discord.gg/sip )
⠀ ⠀\`🌸\`┊[Kokoro]( https://discord.gg/kokoro )
⠀ ⠀\`🍰\`︰[Animekos]( https://discord.gg/animekos?ref=pockytime )

・୨・┈┈┈┈・୨୧・┈┈┈┈・୧・`,
 });
};

const gameverse = async (member: RMember) => {
 member.client.util.notificationThread(member, {
  content: `<:AMayakoLove:874102206176034826> Check out our lovely Sister Server:
 https://discord.gg/animekos?ref=gameverse`,
 });
};
