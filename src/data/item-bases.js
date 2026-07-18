// GENERATO dagli item embedded di templates/golden-actor-zariel-2014.json
// (export reale Foundry 13.351 / dnd5e 5.3.3 + Midi-QOL). Non modificare a mano.
export const WEAPON_BASE = {
  "_id": "",
  "name": "",
  "type": "weapon",
  "system": {
    "source": {
      "custom": "",
      "book": "",
      "page": "",
      "license": "",
      "rules": "2014",
      "revision": 1
    },
    "description": {
      "value": "",
      "chat": ""
    },
    "range": {
      "value": 5,
      "long": null,
      "units": "ft"
    },
    "proficient": 1,
    "uses": {
      "max": "",
      "spent": 0,
      "recovery": []
    },
    "type": {
      "value": "natural",
      "baseItem": ""
    },
    "properties": [],
    "activities": {},
    "identifier": "",
    "identified": true,
    "unidentified": {
      "description": ""
    },
    "container": null,
    "quantity": 1,
    "weight": {
      "value": 0,
      "units": "lb"
    },
    "price": {
      "value": 0,
      "denomination": "gp"
    },
    "rarity": "",
    "attunement": "",
    "attuned": false,
    "equipped": true,
    "ammunition": {},
    "armor": {},
    "damage": {
      "base": {
        "types": [],
        "custom": {
          "enabled": false
        },
        "scaling": {
          "number": 1
        }
      },
      "versatile": {
        "types": [],
        "custom": {
          "enabled": false
        },
        "scaling": {
          "number": 1
        }
      }
    },
    "crew": {
      "value": []
    }
  },
  "img": "icons/svg/sword.svg",
  "flags": {},
  "effects": [],
  "_stats": {
    "compendiumSource": null,
    "duplicateSource": null,
    "exportSource": null,
    "coreVersion": "13.351",
    "systemId": "dnd5e",
    "systemVersion": "5.3.3",
    "lastModifiedBy": null,
    "createdTime": null,
    "modifiedTime": null
  },
  "folder": null,
  "sort": 0,
  "ownership": {
    "default": 0
  }
};

export const FEAT_BASE = {
  "_id": "",
  "name": "",
  "type": "feat",
  "system": {
    "source": {
      "custom": "",
      "book": "",
      "page": "",
      "license": "",
      "rules": "2014",
      "revision": 1
    },
    "description": {
      "value": "",
      "chat": ""
    },
    "requirements": "",
    "uses": {
      "max": "",
      "spent": 0,
      "recovery": []
    },
    "type": {
      "value": "monster",
      "subtype": ""
    },
    "properties": [],
    "advancement": {},
    "activities": {},
    "identifier": "",
    "crewed": false,
    "enchant": {},
    "prerequisites": {
      "items": [],
      "repeatable": false
    }
  },
  "img": "icons/svg/aura.svg",
  "flags": {},
  "effects": [],
  "_stats": {
    "compendiumSource": null,
    "duplicateSource": null,
    "exportSource": null,
    "coreVersion": "13.351",
    "systemId": "dnd5e",
    "systemVersion": "5.3.3",
    "lastModifiedBy": null,
    "createdTime": null,
    "modifiedTime": null
  },
  "folder": null,
  "sort": 0,
  "ownership": {
    "default": 0
  }
};

export const ACTIVITY_BASES = {
  attack: {
  "_id": "",
  "type": "attack",
  "name": "",
  "activation": {
    "type": "action",
    "value": 1,
    "override": false
  },
  "target": {
    "prompt": true,
    "template": {
      "contiguous": false,
      "units": "ft",
      "stationary": false
    },
    "affects": {
      "choice": false
    },
    "override": false
  },
  "attack": {
    "flat": false,
    "type": {
      "value": "melee",
      "classification": ""
    },
    "ability": "str",
    "bonus": "",
    "critical": {}
  },
  "damage": {
    "parts": [],
    "critical": {},
    "includeBase": true
  },
  "sort": 0,
  "consumption": {
    "scaling": {
      "allowed": false
    },
    "spellSlot": true,
    "targets": []
  },
  "description": {},
  "duration": {
    "units": "inst",
    "concentration": false,
    "override": false
  },
  "effects": [],
  "range": {
    "units": "self",
    "override": false
  },
  "uses": {
    "spent": 0,
    "recovery": []
  },
  "useConditionText": "",
  "useConditionReason": "",
  "effectConditionText": "",
  "macroData": {
    "name": "",
    "command": ""
  },
  "ignoreTraits": {
    "idi": false,
    "idr": false,
    "idv": false,
    "ida": false,
    "idm": false
  },
  "midiProperties": {
    "ignoreTraits": [],
    "triggeredActivityId": "none",
    "triggeredActivityConditionText": "",
    "triggeredActivityTargets": "targets",
    "triggeredActivityRollAs": "self",
    "autoConsume": false,
    "forceConsumeDialog": "default",
    "forceRollDialog": "default",
    "forceDamageDialog": "default",
    "confirmTargets": "default",
    "autoTargetType": "any",
    "autoTargetAction": "default",
    "automationOnly": false,
    "otherActivityCompatible": true,
    "otherActivityAsParentType": true,
    "identifier": "",
    "displayActivityName": false,
    "rollMode": "default",
    "chooseEffects": false,
    "toggleEffect": false,
    "ignoreFullCover": false,
    "removeChatButtons": "default",
    "magicEffect": false,
    "magicDamage": false,
    "noConcentrationCheck": false,
    "autoCEEffects": "default",
    "triggeredActivityConsume": true,
    "triggeredActivityConfigure": true,
    "skipConcentrationCheck": false
  },
  "isOverTimeFlag": false,
  "overTimeProperties": {
    "saveRemoves": true,
    "preRemoveConditionText": "",
    "postRemoveConditionText": "",
    "rollAs": "target"
  },
  "otherActivityId": "",
  "otherActivityAsParentType": true,
  "attackMode": "oneHanded",
  "ammunition": "",
  "otherActivityUuid": "",
  "attackRollPerTarget": "default",
  "fumbleThreshold": 1,
  "img": null,
  "flags": {},
  "visibility": {
    "level": {},
    "requireAttunement": false,
    "requireIdentification": false,
    "requireMagic": false
  }
},
  save: {
  "_id": "",
  "type": "save",
  "name": "",
  "activation": {
    "type": "action",
    "value": 1,
    "override": false
  },
  "consumption": {
    "scaling": {
      "allowed": false
    },
    "spellSlot": true,
    "targets": []
  },
  "description": {},
  "duration": {
    "units": "inst",
    "concentration": false,
    "override": false
  },
  "effects": [],
  "range": {
    "units": "self",
    "override": false
  },
  "target": {
    "template": {
      "count": "",
      "contiguous": false,
      "type": "",
      "size": "",
      "width": "",
      "height": "",
      "units": "ft",
      "stationary": false
    },
    "affects": {
      "count": "1",
      "type": "creature",
      "choice": false,
      "special": ""
    },
    "override": false,
    "prompt": true
  },
  "uses": {
    "spent": 0,
    "recovery": []
  },
  "save": {
    "ability": [
      "con"
    ],
    "dc": {
      "calculation": "",
      "formula": ""
    }
  },
  "damage": {
    "onSave": "none",
    "parts": [],
    "critical": {
      "allow": false
    }
  },
  "sort": 0,
  "useConditionText": "",
  "useConditionReason": "",
  "effectConditionText": "",
  "macroData": {
    "name": "",
    "command": ""
  },
  "ignoreTraits": {
    "idi": false,
    "idr": false,
    "idv": false,
    "ida": false,
    "idm": false
  },
  "midiProperties": {
    "ignoreTraits": [],
    "triggeredActivityId": "none",
    "triggeredActivityConditionText": "",
    "triggeredActivityTargets": "targets",
    "triggeredActivityRollAs": "self",
    "autoConsume": false,
    "forceConsumeDialog": "default",
    "forceRollDialog": "default",
    "forceDamageDialog": "default",
    "confirmTargets": "default",
    "autoTargetType": "any",
    "autoTargetAction": "default",
    "automationOnly": false,
    "otherActivityCompatible": true,
    "otherActivityAsParentType": true,
    "identifier": "",
    "displayActivityName": false,
    "rollMode": "default",
    "chooseEffects": false,
    "toggleEffect": false,
    "ignoreFullCover": false,
    "removeChatButtons": "default",
    "magicEffect": false,
    "magicDamage": false,
    "noConcentrationCheck": false,
    "autoCEEffects": "default",
    "triggeredActivityConsume": true,
    "triggeredActivityConfigure": true,
    "skipConcentrationCheck": false
  },
  "isOverTimeFlag": false,
  "overTimeProperties": {
    "saveRemoves": true,
    "preRemoveConditionText": "",
    "postRemoveConditionText": "",
    "rollAs": "target"
  },
  "otherActivityId": "",
  "otherActivityAsParentType": true,
  "friendlySave": "default",
  "img": null,
  "flags": {},
  "visibility": {
    "level": {},
    "requireAttunement": false,
    "requireIdentification": false,
    "requireMagic": false
  }
},
  utility: {
  "_id": "",
  "type": "utility",
  "activation": {
    "type": "action",
    "value": 1,
    "override": false
  },
  "consumption": {
    "scaling": {
      "allowed": false
    },
    "spellSlot": true,
    "targets": []
  },
  "description": {},
  "duration": {
    "units": "inst",
    "concentration": false,
    "override": false
  },
  "effects": [],
  "range": {
    "units": "self",
    "override": false
  },
  "target": {
    "template": {
      "contiguous": false,
      "units": "ft",
      "stationary": false
    },
    "affects": {
      "choice": false
    },
    "override": false,
    "prompt": true
  },
  "uses": {
    "spent": 0,
    "recovery": []
  },
  "roll": {
    "prompt": false,
    "visible": false
  },
  "sort": 0,
  "useConditionText": "",
  "useConditionReason": "",
  "effectConditionText": "",
  "macroData": {
    "name": "",
    "command": ""
  },
  "ignoreTraits": {
    "idi": false,
    "idr": false,
    "idv": false,
    "ida": false,
    "idm": false
  },
  "midiProperties": {
    "ignoreTraits": [],
    "triggeredActivityId": "none",
    "triggeredActivityConditionText": "",
    "triggeredActivityTargets": "targets",
    "triggeredActivityRollAs": "self",
    "autoConsume": false,
    "forceConsumeDialog": "default",
    "forceRollDialog": "default",
    "forceDamageDialog": "default",
    "confirmTargets": "default",
    "autoTargetType": "any",
    "autoTargetAction": "default",
    "automationOnly": false,
    "otherActivityCompatible": true,
    "otherActivityAsParentType": true,
    "identifier": "",
    "displayActivityName": false,
    "rollMode": "default",
    "chooseEffects": false,
    "toggleEffect": false,
    "ignoreFullCover": false,
    "removeChatButtons": "default",
    "magicEffect": false,
    "magicDamage": false,
    "noConcentrationCheck": false,
    "autoCEEffects": "default",
    "triggeredActivityConsume": true,
    "triggeredActivityConfigure": true,
    "skipConcentrationCheck": false
  },
  "isOverTimeFlag": false,
  "overTimeProperties": {
    "saveRemoves": true,
    "preRemoveConditionText": "",
    "postRemoveConditionText": "",
    "rollAs": "target"
  },
  "otherActivityId": "none",
  "otherActivityAsParentType": true,
  "img": null,
  "flags": {},
  "visibility": {
    "level": {},
    "requireAttunement": false,
    "requireIdentification": false,
    "requireMagic": false
  },
  "name": ""
},
};

export const DAMAGE_PART_BASE = {
  "types": [],
  "number": 1,
  "denomination": 6,
  "bonus": "",
  "scaling": {
    "mode": "",
    "number": 1
  },
  "custom": {
    "enabled": false
  }
};

export const EFFECT_BASE = {
  "_id": "",
  "name": "",
  "img": "",
  "type": "base",
  "system": {},
  "changes": [],
  "disabled": false,
  "duration": {
    "rounds": null,
    "startTime": null,
    "combat": null
  },
  "description": "",
  "origin": null,
  "statuses": [],
  "transfer": false,
  "flags": {
    "dae": {
      "specialDuration": [],
      "stackable": "noneName"
    }
  },
  "_stats": {
    "compendiumSource": null,
    "duplicateSource": null,
    "exportSource": null,
    "coreVersion": "13.351",
    "systemId": "dnd5e",
    "systemVersion": "5.3.3",
    "lastModifiedBy": null
  },
  "tint": "#ffffff",
  "sort": 0
};
