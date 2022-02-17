import { Context } from "microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common.speech/RecognizerConfig";
import { title } from "process";
import { textSpanIntersectsWith } from "typescript";
import { MachineConfig, send, Action, assign } from "xstate";
import { init } from "xstate/lib/actionTypes";
export {}

declare var context: any



// @ts-ignore
function say(text: string): Action<SDSContext, SDSEvent> {
    // @ts-ignore
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}


const kbRequest = (text: string) =>
    fetch(new Request(`https://cors.eu.org/https://api.duckduckgo.com/?q=${text}&format=json&skip_disambig=1`)).then(data => data.json())


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

const grammar2: { [index: string]: { negation?: string, affirmation?: string} } = {
    "No.": { negation: "No."},
    "Yes.": {affirmation: "Yes."},
    "Of course.": {affirmation: "Yes."},
    "No way.": {negation: "No."},
    "Sure.": {affirmation: "Yes."}
}

const menu_grammar: { [index: string]: { meeting?: string, person?: string } } = {
    "I want to create a meeting.": {meeting: "Yes"},
    "Create a meeting.": {meeting: "Yes"},
    "Meeting": {meeting: "Yes"},
    "I want to search for someone.": {person: "Yes"},
    "Search for someone.": {person: "Yes"},
    "Search.": {person: "Yes"}
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
                TTS_READY: 'username',
                CLICK: 'username'
            }
        },
        username: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'hello',
                        actions: assign({ username: (context) => context.recResult[0].utterance })
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("What is your name?"),
                    on: { ENDSPEECH: 'ask'}
                },
                ask: {
                    entry: send('LISTEN')
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
            on: {
                RECOGNISED: [
                    {
                        target: 'meeting',
                        cond: (context) => "meeting" in (menu_grammar[context.recResult[0].utterance] || {}),
                    
                    },
                    {
                        target: 'searchPerson',
                        cond: (context) => "person" in (menu_grammar[context.recResult[0].utterance] || {}),
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Do you want to search for someone on the internet or create a meeting?"),
                    on: {ENDSPEECH: 'ask'}
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
        searchPerson: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'searching',
                        actions: assign({ person: (context) => context.recResult[0].utterance })
                    },
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Who are you searching for?"),
                    on: {ENDSPEECH: 'ask'}
                },
                ask: {
                    entry: send('LISTEN')
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
            on: {
                RECOGNISED: [
                    {
                        target: 'askday',
                        cond: (context) => "affirmation" in (grammar2[context.recResult[0].utterance] || {}),
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
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Do you want to meet them?"),
                    on: { ENDSPEECH: 'ask'}
                },
                ask: {
                    entry: send('LISTEN')
                },
                nomatch: {
                    entry: say("Could you repeat that?"),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },
        meeting: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'info',
                        cond: (context) => "title" in (grammar[context.recResult[0].utterance] || {}),
                        actions: assign({ title: (context) => grammar[context.recResult[0].utterance].title! })
                
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Let's create a meeting. What is it about?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
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
            on: {
                RECOGNISED: [
                    {
                        target: 'infoday',
                        cond: (context) => "day" in (grammar[context.recResult[0].utterance] || {}),
                        actions: assign({ day: (context) => grammar[context.recResult[0].utterance].day! })
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("On which day is it?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I didn't understand. Which day is that?"),
                    on: { ENDSPEECH: 'ask' }
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
            on: {
                RECOGNISED: [
                    {
                        target: 'infowholeday',
                        cond: (context) => "affirmation" in (grammar2[context.recResult[0].utterance] || {})
                    },
                    {
                        target: 'asktime',
                        cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {}) 
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Will it take the whole day?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I didn't understand. Can you repeat?"),
                    on: { ENDSPEECH: 'ask' }
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
            on: {
                RECOGNISED: [
                    {
                        target: 'meetingcreated',
                        cond: (context) => "affirmation" in (grammar2[context.recResult[0].utterance] || {})
                    },
                    {
                        target: 'meeting', cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {})
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: send ((context) => ({
                        type: 'SPEAK',
                        value: `Do you want me to create a meeting titled ${context.title} on ${context.day} for the whole day? `
                    })),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I didn't hear that."),
                    on: { ENDSPEECH: 'ask' }
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

        // infotime: {
        //     entry: send((context) => ({
        //         type: 'SPEAK',
        //         value: `{'Ok.}`
        //     })),
        //     on: { ENDSPEECH: 'asktime'}
        // },
        asktime: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'infoasktime',
                        cond: (context) => "time" in (grammar[context.recResult[0].utterance] || {}),
                        actions: assign({ time: (context) => grammar[context.recResult[0].utterance].time! })
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("What time is your meeting?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I didn't understand. Can you repeat the time?"),
                    on: { ENDSPEECH: 'ask' }
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
            on: {
                RECOGNISED: [
                    {
                        target: 'meetingcreated',
                        cond: (context) => "affirmation" in (grammar2[context.recResult[0].utterance] || {}),
                    },
                    {
                        target: 'meeting', cond: (context) => "negation" in (grammar2[context.recResult[0].utterance] || {}),

                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: send ((context) => ({
                        type: 'SPEAK',
                        value: `Do you want me to create a meeting titled ${context.title} on ${context.day} at ${context.time}? `
                    })),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I didn't hear that."),
                    on: { ENDSPEECH: 'ask' }
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
)
