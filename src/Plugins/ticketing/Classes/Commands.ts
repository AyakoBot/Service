import { TicketPriority } from '@ayako/database';
import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType } from '@discordjs/core';

import en from '../Language/en-GB.json' with { type: 'json' };
import { priorityMeta } from '../Util/priority.js';

import { TicketCommandOption, ticketCommandName, TicketSubcommand } from './Routes.js';

export const ticketCommand = () =>
 new SlashCommandBuilder()
  .setName(ticketCommandName)
  .setDescription('Manage tickets')
  .setContexts([InteractionContextType.Guild])
  .addSubcommand((sub) =>
   sub
    .setName(TicketSubcommand.Open)
    .setDescription('Open a ticket with a member')
    .addUserOption((option) =>
     option
      .setName(TicketCommandOption.User)
      .setDescription('The member to open a ticket with')
      .setRequired(true),
    ),
  )
  .addSubcommand((sub) => sub.setName(TicketSubcommand.Claim).setDescription('Claim this ticket'))
  .addSubcommand((sub) =>
   sub.setName(TicketSubcommand.Unclaim).setDescription('Release your claim on this ticket'),
  )
  .addSubcommand((sub) =>
   sub.setName(TicketSubcommand.Take).setDescription('Take over this ticket from its claimer'),
  )
  .addSubcommand((sub) =>
   sub
    .setName(TicketSubcommand.Escalate)
    .setDescription('Escalate this ticket to a higher tier')
    .addStringOption((option) =>
     option
      .setName(TicketCommandOption.Tier)
      .setDescription('The tier to escalate to. Leave empty to pick from a list')
      .setRequired(false)
      .setAutocomplete(true),
    ),
  )
  .addSubcommand((sub) => sub.setName(TicketSubcommand.Close).setDescription('Close this ticket'))
  .addSubcommand((sub) =>
   sub.setName(TicketSubcommand.Delete).setDescription('Delete this closed ticket'),
  )
  .addSubcommand((sub) =>
   sub
    .setName(TicketSubcommand.Add)
    .setDescription('Let a member see this ticket')
    .addUserOption((option) =>
     option.setName(TicketCommandOption.User).setDescription('The member to add').setRequired(true),
    ),
  )
  .addSubcommand((sub) =>
   sub
    .setName(TicketSubcommand.Remove)
    .setDescription('Remove a member from this ticket')
    .addUserOption((option) =>
     option
      .setName(TicketCommandOption.User)
      .setDescription('The member to remove')
      .setRequired(true),
    ),
  )
  .addSubcommand((sub) =>
   sub
    .setName(TicketSubcommand.Priority)
    .setDescription('Set the priority of this ticket')
    .addStringOption((option) =>
     option
      .setName(TicketCommandOption.Level)
      .setDescription('The new priority')
      .setRequired(true)
      .addChoices(
       ...Object.values(TicketPriority).map((priority) => ({
        name: en[priorityMeta[priority].key],
        value: priority,
       })),
      ),
    ),
  )
  .addSubcommand((sub) =>
   sub.setName(TicketSubcommand.Info).setDescription('Show the details of this ticket'),
  )
  .addSubcommand((sub) =>
   sub
    .setName(TicketSubcommand.List)
    .setDescription('List the open tickets you can handle')
    .addUserOption((option) =>
     option
      .setName(TicketCommandOption.User)
      .setDescription('Only list tickets opened by this member')
      .setRequired(false),
    ),
  );
