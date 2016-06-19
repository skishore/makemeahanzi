import {Popup} from '/client/templates/popup/code';

const character = new ReactiveVar();
const issue = {character_data: null, recording: null};

class ReportIssue {
  static cancel() {
    _.keys(issue).map((x) => delete issue[x]);
    Popup.hide(50);
  }
  static okay() {
    issue.message = $('#report-issue > textarea.message').val();
    Meteor.call('reportIssue', issue);
    _.keys(issue).map((x) => delete issue[x]);
    const button = {class: 'bold', label: 'Continue'};
    const text = 'Thank you! Your feedback helps us improve Inkstone.';
    Meteor.defer(() => Popup.show(
      {buttons: [button], text: text, title: 'Issue Reported'}));
  }
  static show(character_data, recording) {
    character.set(character_data.character);
    issue.character_data = character_data;
    issue.recording = recording;
    const buttons = [];
    buttons.push({callback: ReportIssue.cancel, label: 'Cancel'});
    buttons.push({callback: ReportIssue.okay, class: 'bold', label: 'Okay'});
    Popup.show({
      buttons: buttons,
      template: 'report_issue',
      title: 'Report an Issue',
    });
  }
};

Template.report_issue.events({
  // Mobile keyboards can mess up the scroll position, so we fix it here.
  // TODO(zhaizhai): Maybe try to animate the scroll.
  'blur .message': () => $(window).scrollTop(0),
});

Template.report_issue.helpers({
  character: () => character.get(),
});

export {ReportIssue};
