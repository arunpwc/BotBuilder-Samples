// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { DialogSet, DialogTurnStatus, ComponentDialog, WaterfallDialog, TextPrompt, DateTimePrompt,
     ChoicePrompt } = require('botbuilder-dialogs');
const { FlightDialog } = require('./flights');
const { HotelsDialog } = require('./hotels');
const { BASE_DIALOG,
    MAIN_DIALOG,
    INITIAL_PROMPT,
    HOTELS_DIALOG,
    INITIAL_HOTEL_PROMPT,
    CHECKIN_DATETIME_PROMPT,
    HOW_MANY_NIGHTS_PROMPT,
    FLIGHTS_DIALOG,
    USER_PROFILE_PROPERTY,
    CONVERSATION_STATE_ACCESSOR
} = require('../const');

class MainDialog extends ComponentDialog {
    constructor(userState, conversationState) {
        super(MAIN_DIALOG);
        this.userState = userState;
        this.conversationState = conversationState;
        this.userProfileAccessor = userState.createProperty(USER_PROFILE_PROPERTY);
        this.conversationStateAccessor = userState.createProperty(CONVERSATION_STATE_ACCESSOR);

        // Create a dialog set for the bot. It requires a DialogState accessor, with which
        // to retrieve the dialog state from the turn context.
        this.addDialog(new ChoicePrompt(INITIAL_PROMPT, this.validateNumberOfAttempts.bind(this)));
        this.addDialog(new TextPrompt(INITIAL_HOTEL_PROMPT));
        this.addDialog(new DateTimePrompt(CHECKIN_DATETIME_PROMPT));
        this.addDialog(new TextPrompt(HOW_MANY_NIGHTS_PROMPT));
        this.addDialog(new FlightDialog(FLIGHTS_DIALOG));

        // Define the steps of the base waterfall dialog and add it to the set.
        this.addDialog(new WaterfallDialog(BASE_DIALOG, [
            this.promptForBaseChoice.bind(this),
            this.respondToBaseChoice.bind(this),
        ]));

        // Define the steps of the hotels waterfall dialog and add it to the set.
        this.addDialog(new HotelsDialog(HOTELS_DIALOG));

        this.initialDialogId = BASE_DIALOG;

    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    async promptForBaseChoice(stepContext) {
        return await stepContext.prompt(
            INITIAL_PROMPT, {
                prompt: 'Are you looking for a flight or a hotel?',
                choices: ['Hotel', 'Flight'],
                retryPrompt: 'Not a valid option'
            }
        );
    }

    async respondToBaseChoice(stepContext) {
        // Retrieve the user input.
        const answer = stepContext.result.value;
        if (!answer) {
            // exhausted attempts and no selection, start over
            await stepContext.context.sendActivity("Not a valid option. We'll restart the dialog "
                + 'so you can try again!');
            return await stepContext.endDialog();
        }
        if(answer === 'Hotel') {
            return await stepContext.beginDialog(HOTELS_DIALOG);
        }
        if(answer === 'Flight') {
            return await stepContext.beginDialog(FLIGHTS_DIALOG);
        }
        return await stepContext.endDialog();
    }

    async validateNumberOfAttempts(promptContext) {
        if (promptContext.attemptCount > 3) {
            // cancel everything
            await promptContext.context.sendActivity("Oops! Too many attempts :( But don't worry, I'm "
                + 'handling that exception and you can try again!');
            return await promptContext.context.endDialog();
        }

        if(!promptContext.recognized.succeeded) {
          await promptContext.context.sendActivity(promptContext.options.retryPrompt);
          return false;
        }
        return true;
    }
}

module.exports.MainDialog = MainDialog;
