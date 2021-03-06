/* global Accounts, App, Tools, Lungo, Messenger, Geo, Chat, OTR, Message, Make */

/**
* @file Holds {@link Plus}
* @author [Adán Sánchez de Pedro Crespo]{@link https://github.com/aesedepece}
* @author [Jovan Gerodetti]{@link https://github.com/TitanNano}
* @author [Giovanny Andres Gongora Granada]{@link https://github.com/Gioyik}
* @author [Sukant Garg]{@link https://github.com/gargsms}
* @license AGPLv3
*/

'use strict';

/**
 * @namespace
 */
var Plus = {

  /**
   * Triggers a bolt on the users device
   */
  bolt: function () {
    var account = Accounts.current;
    var to = $('section#chat')[0].dataset.jid;
    if (to && App.online && account.connector.connection.connected){
      if (account.supports('attention')) {
        account.connector.attentionSend(to);
        window.navigator.vibrate([100,30,100,30,100,200,200,30,200,30,200,200,100,30,100,30,100]);
        App.audio('thunder');
        Tools.log('Sent a bolt to', to);
      } else {
        Lungo.Notification.error(_('NoSupport'), _('XMPPisBetter'), 'exclamation-sign');
      }
    }
  },

  /**
   * Adds an emoji to the messenges text box.
   *
   * @param {string} emoji
   */
  emoji: function (emoji) {
    Messenger.add(emoji);
  },

  /**
   * Triggers a file pick [{MozActivity}]{@link external:System.MozActivity}
   */
  fileSend: function () {
    var account = Accounts.current;
    var fileTypes = [];
    var to = $('section#chat')[0].dataset.jid;


    if (account.supports('imageSend')) {
      fileTypes = fileTypes.concat(['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/bmp']);
    }

    if (account.supports('videoSend')) {
      fileTypes = fileTypes.concat(['video/webm', 'video/mp4', 'video/3gpp']);
    }

    if (account.supports('audioSend')) {
      fileTypes = fileTypes.concat(['audio/mpeg', 'audio/ogg', 'audio/mp4']);
    }

    var e = new MozActivity({
      name: 'pick',
      data: {
        type: fileTypes
      }
    });

    e.onsuccess = function () {
      var blob = this.result.blob;
      account.connector.fileSend(to, blob);
    };
  },

  /**
   * Sends the current location to the active chat.
   */
  locationSend: function () {
    var account = Accounts.current;
    if (account.supports('locationSend')) {
      var to = $('section#chat')[0].dataset.jid;
      Geo.posGet(function (loc) {
        account.connector.locationSend(to, loc);
      });
    } else {
      Lungo.Notification.error(_('NoSupport'), _('XMPPisBetter'), 'exclamation-sign');
    }
  },

  /**
   * @param {*} constraints
   */
  rtc: function (constraints) {

  },

  /**
   * switches the user matching the given jid to an OTR encrypted conversation.
   *
   * @param {string} jid
   * @param {Account} account
   */
  switchOTR: function (jid, account) {
    account = account || Accounts.current;
    var ci = account.chatFind(jid);
    var chat= null;
    if (ci < 0) {
      var contact = Lungo.Core.findByProperty(account.core.roster, 'jid', jid);
      chat = Make(Chat)({
        jid: jid,
        title: contact ? contact.name || jid : jid,
        chunks: [],
      }, account);
      account.chats.push(chat);
      account.core.chats.push(chat.core);
    } else {
      chat = account.chats[ci];
    }
    if (chat.core.settings.otr[0]) {
      // This chat should be private
      if (account.OTR.enabled) {
        // Has OTR key, let's go OTR
        if (!chat.OTR) {
          this.goOTR(chat);
        }
      } else {
        // No key, let's create one
        account.OTRMenu();
      }
    } else {
      // Plain chat
      if (chat.OTR) {
        // OTR is in use, let's kill it
        this.killOTR(chat);
      }
    }
  },

  /**
   * Switches a [{Chat}]{@link Chat} to OTR??
   *
   * @param {Chat} chat
   */
  goOTR: function (chat) {
    Tools.log('GOING OTR IN', chat);
    var account = chat.account;
    chat.OTR = new OTR({
      priv: account.OTR.key
    });
    chat.OTR.on('ui', function (text) {
      var msg = Make(Message)(account, {
        to: account.core.user,
        from: chat.core.jid,
        text: text,
        stamp: Tools.localize(Tools.stamp()),
      }, {
        otr: true,
        logging: account.OTR.logging
      });
      msg.postReceive();
    });
    chat.OTR.on('io', function (id, text) {
      var msg = Make(Message)(account, {
        from: account.core.user,
        to: chat.core.jid,
        text: text,
        stamp: Tools.localize(Tools.stamp()),
        original: id
      }, {
        otr: true,
        logging: account.OTR.logging,
        render: false
      });
      msg.postSend();
    });
    chat.OTR.on('error', function (err) {
      Tools.log('OTR-ERROR', err);
    });
    chat.OTR.on('status', function (state) {
      switch (state) {
        case OTR.CONST.STATUS_AKE_SUCCESS:
          if (chat.OTR.msgstate === OTR.CONST.MSGSTATE_ENCRYPTED) {
            // The chat is secure
            $('section#chat[data-jid="' + chat.core.jid + '"]')[0].dataset.otr= 'true';
          } else {
            // The chat is no longer secure
            $('section#chat[data-jid="' + chat.core.jid + '"]')[0].dataset.otr= 'false';
            delete chat.OTR;
          }
          break;
        case OTR.CONST.STATUS_END_OTR:
          // The chat is no longer secure
          $('section#chat[data-jid="' + chat.core.jid + '"]')[0].dataset.otr= 'false';
          delete chat.OTR;
          break;
      }
    });
    chat.OTR.sendQueryMsg();
  },

  /**
   * Swichtes a [{Chat}]{@link Chat} back to non-OTR
   *
   * @param {Chat} chat
   */
  killOTR: function (chat) {
    chat.OTR.endOtr();
    delete chat.OTR;
  },

  /**
   * Shows the in-app console
   */
  showConsole: function() {
    $('#console').show();
  },

  /**
   * Hides the in-app console
   */
  hideConsole: function() {
    $('#console').hide();
  },

  /**
   * Writes to the in-app console
   *
   * @param {string} msg
   */
  log: function(msg) {
    var node=document.createElement("DIV");
    var textnode=document.createTextNode(msg);
    node.appendChild(textnode);
    document.getElementById('logConsole').appendChild(node);
    while(document.getElementById('logConsole').childNodes.length>15)
    {
      document.getElementById('logConsole').removeChild(document.getElementById('logConsole').firstChild);
    }
  },

  /**
   * Clears the in-app console.
   */
  clearConsole: function() {
    document.getElementById('logConsole').innerHTML='';
  }

};
