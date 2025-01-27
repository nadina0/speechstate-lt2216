import { Context } from "microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common.speech/RecognizerConfig";
import { title } from "process";
import { textSpanIntersectsWith } from "typescript";
import { MachineConfig, send, Action, assign } from "xstate";
import { init } from "xstate/lib/actionTypes";
export {}

declare var context: any
declare var counter: any


// @ts-ignore
function say(text: string): Action<SDSContext, SDSEvent> {
    // @ts-ignore
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}


const kbRequest = (text: string) =>
    fetch(new Request(`https://cors.eu.org/https://api.duckduckgo.com/?q=${text}&format=json&skip_disambig=1`)).then(data => data.json())


const rasaurl = 'https://speechstate.herokuapp.com/model/parse';

const nluRequest = (text: string) =>
    fetch(new Request(rasaurl, {
        method: 'POST',
        body: `{'text': ${text}'}`
    }))
        .then(data => data.json());


const assistant_grammar: {[index: string]: {action?: string}} = {
    "vacuum": {action: "vacuum"},
    "move_to_trasn": {action: "throw this in the trash"},
    "give": {action: "give this"},
    "turn_on_light": {action: "turn on the light"},
    "turn_off_light": {action: "turn off the light"},
    "play_music": {action: "play some music"},
    "ask_oven_warm": {action: "see if the oven is warm"},
    "inform_oven_warm": {action: "say that the oven is warm"}

}
const grammar: { [index: string]: { title?: string, day?: string, time?: string } } = {
    "Lecture.": { title: "Dialogue systems lecture" },
    "Lunch.": { title: "Lunch at the canteen" },
    "Socks.": {title: "Let's check who has mismatched socks"},
    "Food.": {title: "We need to find out who's been stealing from the fridge"},
    "Brainstorming.": {title: "Brainstorming ideas"},
    "Bookclub.": {title: "Discussing the latest book for our club."},
    "Movie.": {title: "Movie night."},
    "Monday": {day: "Monday"},
    "Tuesday.": {day: "Tuesday"},
    "Wednesday.": {day: "Wednesday"},
    "Thursday.": {day: "Thursday"},
    "Friday": { day: "Friday" },
    "Tomorrow.": {day: "tomorrow"},
    "Next week.": {day: "next week"},
    "At 9": { time: "09:00" },
    "At 10": { time: "10:00" },
    "At 11": { time: "11:00" },
    "At 12": {time: "12:00"},
    "At 1": { time: "13:00" },
    "At 2": {time: "14:00"},
    "At 3": { time: "15:00" },
    "At 4": { time: "16:00" },
    "At 5": { time: "17:00" },
    "At 6": { time: "18:00" },
    "At 7": { time: "19:00" },
    "At 8": { time: "20:00" },
}

const grammar2: { [index: string]: { negation?: string, affirmation?: string, help?: string} } = {
    "No.": { negation: "No."},
    "Yes.": {affirmation: "Yes."},
    "Of course.": {affirmation: "Yes."},
    "No way.": {negation: "No."},
    "Sure.": {affirmation: "Yes."},
    "Help.": {help: "Help"}
}

const menu_grammar: { [index: string]: { meeting?: string, person?: string, assistant?: string } } = {
    "I want to create a meeting.": {meeting: "Yes"},
    "Create a meeting.": {meeting: "Yes"},
    "Meeting": {meeting: "Yes"},
    "I want to search for someone.": {person: "Yes"},
    "Search for someone.": {person: "Yes"},
    "Search.": {person: "Yes"},
    "I want the assistant": {assistant: "Yes"},
    "Assist me with something": {assistant: "Yes"},
    "Assistant": {assistant: "Yes"},
    "Home assistant": {assistant: "Yes"},
    "Open the home assistant": {assistant: "Yes"},
    "Open  home assistant": {assistant: "Yes"}

}


// @ts-ignore
export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'idle',

    states: {
        idle: {
            on: {
                CLICK: 'init'
            }
        },
        init: {
            on: {
                TTS_READY: 'appointment',
                CLICK: 'appointment'
            }
        },
        
        help: {
            initial: 'clarification',
            states: {
                clarification: {
                    entry: say('Listen carefully to the instructions you are presented with.'),
                    on: { ENDSPEECH: '#root.dm.appointment.hist' }
                }
            }
        },

        appointment: {
            initial: 'username',
            entry: assign({counter: (context) => 0}),
            states: {
                hist: {
                    type: 'history',
                },  

                username: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'hello',
                                cond: (context) => context.recResult[0]["confidence"] > 0.5,
                                actions: assign({ username: (context) => context.recResult[0].utterance })
                            },
                            {
                                target: 'userconfirm',
                                cond: (context) => context.recResult[0]["confidence"] < 0.5,
                                actions: assign({ username: (context) => context.recResult[0].utterance })
                            },
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'},
                    },
                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: say("What is your name?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt2: {
                            entry: say("Please tell me your name."),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt3: {
                            entry: say("I didn't hear your name."),
                            on: { ENDSPEECH: 'ask'}
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Can you please repeat your name?"),
                            on: { ENDSPEECH: 'ask'}
                        }
                    }
                },
                userconfirm: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: 'hello',
                                cond: (context) => 'affirmation' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: '#root.dm.appointment',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                            },
                        ],
                    },
                    states: {
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `did you mean to say ${context.username}? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                hello: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Hi, ${context.username}.`
                    })),
                    on: { ENDSPEECH: 'menu'}
                }, 
                menu: {
                    initial: 'prompt',
                    entry: assign({counter: (context) => 0}),
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'meeting',
                                cond: (context) => "meeting" in (menu_grammar[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5,
                            
                            },
                            {
                                target: 'searchPerson',
                                cond: (context) => "person" in (menu_grammar[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5,
                            },
                            {
                                target: 'homeAssistant',
                                cond: (context) => "assistant" in (menu_grammar[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5,
                            },
                            {
                                target: 'confirmmenu',
                                cond: (context) => context.recResult[0]["confidence"] < 0.5,
                            },
                            {
                                target: '.nomatch'
                            }
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'}
                    },
                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: say("Do you want to search for someone on the internet, create a meeting, or open the home assistant?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt2: {
                            entry: say("Please tell me what you would like to do."),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt3: {
                            entry: say("Would you rather set a meeting, search for someone, or get help from your assistant?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Can you please repeat?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                confirmmenu: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: 'searchPerson',
                                cond: (context) => "person" in (menu_grammar[context.recResult[0].utterance] || {}) && 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: 'setMeeting',
                                cond: (context) => "meeting" in (menu_grammar[context.recResult[0].utterance] || {}) && 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: 'homeAssistant',
                                cond: (context) => "assistant" in (menu_grammar[context.recResult[0].utterance] || {}) && 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: '#root.dm.appointment.menu',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                            },
                        ],
                    },
                    states: {
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: "Was that what you meant to say?"
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                
                homeAssistant: {
                    initial: 'prompt',
                    entry: assign({counter: (context) => 0}),
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'helping',
                                actions: assign({ action: (context) => context.recResult[0].utterance }),
                                cond: (context) => context.recResult[0]["confidence"] > 0.5,
                            },
                            {
                                target: 'confirmassistant',
                                cond: (context) => context.recResult[0]["confidence"] < 0.5,
                            },
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'}
                    },
                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: say("What do you need help with?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt2: {
                            entry: say("What should I do?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt3: {
                            entry: say("What do you want me to do?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Can you please repeat?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                confirmassistant: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: 'helping',
                                cond: (context) => 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: '#root.dm.appointment.homeAssistant',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                            },
                        ],
                    },
                    states: {
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `${context.username}, did you mean to say that? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                helping: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `OK, searching the internet for ${context.person}`
                    })),
                    on: {ENDSPEECH: 'assistant_intent'}
                },
                // assistant_intent: {
                //     invoke: {
                //         id: 'assistantintent',
                //         src: (context, event) => nluRequest(context.recResult[0].utterance),
                // //         onDone: {
                // //             target: 'assistantproceed',
                // //             actions: [(context, event) =>  console.log(context, event)
                // //         },
                // //     //     onError: {
                // //     //         target: 'homeAssistant'
                // //     //     }
                // //     // }
                // // },
                assistantproceed: {
                    initial: 'prompt',
                    entry: assign({counter: (context) => 0}),
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'actiondone',
                                cond: (context) => 'affirmation' in (grammar2[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5,
                            },
                            {
                                target: 'homeAssistant',
                                cond: (context) => 'negation' in (grammar2[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5,                            },
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'}
                    },
                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: `$Should I ${context.action}?`
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        prompt2: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: `$Is ${context.action} what you want me to do?`
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        prompt3: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: `$Shall I proceed with ${context.action}?`
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Can you please repeat?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                actiondone: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Ok, I will ${context.action}`
                    })),
                    on: { ENDSPEECH: '#root.dm.init' }
                },                
                searchPerson: {
                    initial: 'prompt',
                    entry: assign({counter: (context) => 0}),
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'searching',
                                actions: assign({ person: (context) => context.recResult[0].utterance }),
                                cond: (context) => context.recResult[0]["confidence"] > 0.5,
                            },
                            {
                                target: 'confirmsearching',
                                cond: (context) => context.recResult[0]["confidence"] < 0.5,
                            },
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'}
                    },
                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: say("Who are you searching for?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt2: {
                            entry: say("Who are you curious about?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt3: {
                            entry: say("Let's decide who to search for"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Can you please repeat?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                confirmsearching: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: 'searching',
                                cond: (context) => 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: '#root.dm.appointment.searchPerson',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                            },
                        ],
                    },
                    states: {
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `did you mean to say ${context.person}? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                searching: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `OK, searching the internet for ${context.person}`
                    })),
                    on: {ENDSPEECH: 'duckgo'}
                },
                duckgo: {
                    invoke: {
                        id: 'duckduckgo',
                        src: (context, event) => kbRequest(context.person),
                        onDone: {
                            target: 'infoperson',
                            actions: assign({ snippet: (context, event) => event.data.AbstractText })
                        },
                        onError: {
                            target: 'searchPerson'
                        }
                    }
                },
                infoperson: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `${context.snippet}`
                    })),
                    on: { ENDSPEECH: 'setMeeting' }
                },
                setMeeting: {
                    initial: 'prompt',
                    entry: assign({counter: (context) => 0}),
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'askday',
                                cond: (context) => "affirmation" in (grammar2[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5 ,
                                actions: assign({ title: (context) => `meeting with ${context.person}`})
                            },
                            {
                                target: 'confirmsetupmeetingwithperson',
                                cond: (context) => context.recResult[0]["confidence"] < 0.5 ,
                                actions: assign({ title: (context) => `meeting with ${context.person}`})
                            },
                            {
                                target: 'menu',
                                cond: (context) => 'negation' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: '.nomatch'
                            }
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'}
                    }, 
                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: say("Do you want to meet them?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt2: {
                            entry: say("Would you like me to set up a meeting with them?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt3: {
                            entry: say("Let's set up a meeting with them."),
                            on: { ENDSPEECH: 'ask'}
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Can you please repeat?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                confirmsetupmeetingwithperson: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: 'askday',
                                cond: (context) => 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: '#root.dm.appointment.setMeeting',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                            },
                        ],
                    },
                    states: {
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `did you mean to say that? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },            
                meeting: {
                    initial: 'prompt',
                    entry: assign({counter: (context) => 0}),
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'info',
                                cond: (context) => "title" in (grammar[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5,
                                actions: assign({ title: (context) => grammar[context.recResult[0].utterance].title! })
                        
                            },
                            {
                                target: 'confirmmeeting',
                                cond: (context) => context.recResult[0]["confidence"] < 0.5,
                                actions: assign({ title: (context) => grammar[context.recResult[0].utterance].title! })
                        
                            },
                            {
                                target: '.nomatch'
                            }
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'}
                    },
                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: say("Let's create a meeting. What is it about?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt2: {
                            entry: say("Shall we create a meeting? Tell me the occasion."),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt3: {
                            entry: say("What would you like you meeting to be about?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                confirmmeeting: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: 'info',
                                cond: (context) => 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: '#root.dm.appointment.meeting',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                            },
                        ],
                    },
                    states: {
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `did you mean to say that? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },     
                info: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `OK, ${context.title}`
                    })),
                    on: { ENDSPEECH: 'askday' }
                },
                askday: {
                    initial: 'prompt',
                    entry: assign({counter: (context) => 0}),
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'infoday',
                                cond: (context) => "day" in (grammar[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5,
                                actions: assign({ day: (context) => grammar[context.recResult[0].utterance].day! })
                            },
                            {
                                target: 'confirmaskday',
                                cond: (context) => context.recResult[0]["confidence"] < 0.5,
                            
                            },
                            {
                                target: '.nomatch'
                            }
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'}
                    },

                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: say("On which day is it?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt2: {
                            entry: say("On which day is your meeting?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt3: {
                            entry: say("When should the meeting be?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, can you please repeat?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                confirmaskday: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: 'infoday',
                                cond: (context) => 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: '#root.dm.appointment.askday',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                            },
                        ],
                    },
                    states: {
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `did you mean to say that? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },   

                infoday: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `OK, ${context.day}`
                    })),
                    on: { ENDSPEECH: 'wholeday' }
                },
                wholeday: {
                    initial: 'prompt',
                    entry: assign({counter: (context) => 0}),
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'infowholeday',
                                cond: (context) => "affirmation" in (grammar2[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5,
                            },
                            {
                                target: 'asktime',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})  && context.recResult[0]["confidence"] > 0.5,
                            },
                            {
                                target: 'confirmwholeday',
                                cond: (context) => context.recResult[0]["confidence"] < 0.5,
                            },
                            {
                                target: '.nomatch'
                            }
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'}
                    },
                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: say("Will it take the whole day?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt2: {
                            entry: say("Is your meeting for the whole day?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt3: {
                            entry: say("Would you like your meeting to be for the whole day?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Could you please repeat?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                confirmwholeday: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.appointment.wholeday',
                                cond: (context) => 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: '#root.dm.appointment.wholeday',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                            },
                        ],
                    },
                    states: {
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `did you mean to say that? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                infowholeday: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `{'Ok, Let's set a meeting for the day.'}`
                    })),
                    on: { ENDSPEECH: 'meetingwholeday'}
                },
                meetingwholeday: {
                    initial: 'prompt',
                    entry: assign({counter: (context) => 0}),
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'meetingcreated',
                                cond: (context) => "affirmation" in (grammar2[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5
                            },
                            {
                                target: 'meeting', cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5
                            },
                            {
                                target: 'meetingwholedayconfirm',
                                cond: (context) =>  context.recResult[0]["confidence"] < 0.5
                            },
                            {
                                target: '.nomatch'
                            }
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'}
                    },
                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `Do you want me to create a meeting titled ${context.title} on ${context.day} for the whole day? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        prompt2: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `Would you like your meeting ${context.title} to be on ${context.day} for the whole day? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        prompt3: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `Should I set up a meeting named ${context.title} on ${context.day} for the whole day? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                meetingwholedayconfirm: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: 'infomeeting',
                                cond: (context) => 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: '#root.dm.appointment.meetingwholeday',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                            },
                        ],
                    },
                    states: {
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `did you mean to say that? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }

                },
                infomeeting: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `OK`
                    })),
                    on: { ENDSPEECH: 'meetingcreated' }
                },
                asktime: {
                    initial: 'prompt',
                    entry: assign({counter: (context) => 0}),
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'infoasktime',
                                cond: (context) => "time" in (grammar[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5,
                                actions: assign({ time: (context) => grammar[context.recResult[0].utterance].time! })
                            },
                            {
                                target: 'confirmasktime',
                                cond: (context) => context.recResult[0]["confidence"] < 0.5,
                            },
                            {
                                target: '.nomatch'
                            }
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'}
                    },
                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: say("What time is your meeting going to be?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt2: {
                            entry: say("What time should I set the meeting for?"),
                            on: { ENDSPEECH: 'ask'}
                        },
                        prompt3: {
                            entry: say("Tell me the time for your meeting."),
                            on: { ENDSPEECH: 'ask'}
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Could you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                confirmasktime: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: 'infoasktime',
                                cond: (context) => 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: '#root.dm.appointment.asktime',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                            },
                        ],
                    },
                    states: {
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `did you mean to say ${context.time}? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }

                },
                infoasktime: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `OK, ${context.time}`
                    })),
                    on: { ENDSPEECH: 'askmeeting2'}
                },
                askmeeting2: {
                    initial: 'prompt',
                    entry: assign({counter: (context) => 0}),
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.help',
                                cond: (context) => 'help' in (grammar2[context.recResult[0].utterance] || {})
                            },
                            {
                                target: 'meetingcreated',
                                cond: (context) => "affirmation" in (grammar2[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5,
                            },
                            {
                                target: 'meeting', cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {}) && context.recResult[0]["confidence"] > 0.5,

                            },
                            {
                                target: 'confirmmeetingcreated',
                                cond: (context) => context.recResult[0]["confidence"] < 0.5,
                            },
                            {
                                target: '.nomatch'
                            }
                        ],
                        TIMEOUT: {actions: assign({ counter: (context) => context.counter+1}), target: '.counts'}
                    },
                    states: {
                        counts: {
                            always: [
                            { target: 'prompt', cond: (context) => context.counter === 0},
                            { target: 'prompt2', cond: (context) => context.counter === 1},
                            { target: 'prompt3', cond: (context) => context.counter === 2},
                            { target: '#root.dm.init', cond: (context) => context.counter === 3},
                            ]
                        },
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `Do you want me to create a meeting titled ${context.title} on ${context.day} at ${context.time}? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        prompt2: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `Would you like your meeting ${context.title} to be on ${context.day} at ${context.time}? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        prompt3: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `Should I set up a meeting named ${context.title} on ${context.day} at ${context.time}? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }
                },
                confirmmeetingcreated: {
                    initial: 'prompt',
                    on: {
                        RECOGNISED: [
                            {
                                target: 'meetingcreated',
                                cond: (context) => 'affirmation' in (grammar2[context.recResult[0].utterance] || {}),
                            },
                            {
                                target: '#root.dm.appointment.askmeeting2',
                                cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                            },
                        ],
                    },
                    states: {
                        prompt: {
                            entry: send ((context) => ({
                                type: 'SPEAK',
                                value: `did you mean to say that? `
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask: {
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't understand. Can you please repeat that?"),
                            on: { ENDSPEECH: 'ask'}
                        }

                    }

                },
                meetingcreated: {
                    initial: 'prompt',
                    states: {
                        prompt: {
                            entry: say("Your meeting has been created!"),
                        },
                    }
                },
            }
        }


    }
}
)
