import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validRegistrationEvent,REGISTRATION_STAGES } from '../../app/lib/registration-event.js';
const event={eventId:'1ec2be31-aa63-45d9-91fc-bf27e883a043',sessionId:'2de9df69-427c-4c1e-aee0-119626d0b4e2',role:'company',stage:'form_open'};
test('registration event accepts only the bounded privacy-safe schema',()=>{
 for(const stage of REGISTRATION_STAGES)assert.equal(validRegistrationEvent({...event,stage}),true);
 assert.equal(validRegistrationEvent({...event,role:'client'}),true);
 assert.equal(validRegistrationEvent({...event,source:'request',device:'mobile'}),true);
 assert.equal(validRegistrationEvent({...event,source:'unknown',device:'unknown'}),true);
 for(const value of [{...event,source:'https://example.com'}, {...event,source:'/requests/?email=secret'},{...event,device:'iPhone17;IP=1.2.3.4'},{...event,device:null}])assert.equal(validRegistrationEvent(value),false);
 for(const value of [null,[],{}, {...event,role:'admin'},{...event,stage:'purchase'}, {...event,sessionId:'x'}, {...event,email:'private@example.ge'}, {...event,phone:'555123456'}, {...event,fieldValue:'password'}, {...event,path:'/account/?email=private'}, {...event,eventId:1}])assert.equal(validRegistrationEvent(value),false);
});
