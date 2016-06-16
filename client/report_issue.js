import {Popup} from './meteoric/popup';

const delay = (ms, func) => {
  return new Promise((resolve) => {
    Meteor.setTimeout(() => {
      // If `func` returns true, then it means `func` will decide when
      // to resolve.
      if (!func(resolve))
        resolve();
    }, ms);
  });
};

class StrokeRecording {
  constructor() {
    this.strokeData = [];
  }

  userStroke(stroke) {
    this.strokeData.push(['user', stroke]);
  }

  matchedStroke(strokeIndex) {
    this.strokeData.push(['match', strokeIndex]);
  }
}

const ReportIssue = {
  charData: null,
  recording: null,
  show: (recording, charData) => {
    ReportIssue.charData = charData;
    ReportIssue.recording = recording;

    Blaze.renderWithData(Template.report_issue, {
      placeholderMessage: "(optional) describe the issue here...",
      character: charData.character
    }, $('body').get(0));
    $('#report-issue').addClass('active');
  },
  hide: (thank) => {
    thank = thank || false;
    ReportIssue.charData = ReportIssue.recording = null;
    $('textarea.report-mesg').val('');
    const element = $('#report-issue');
    element.removeClass('active');

    // TODO(zhaizhai): the hiding animation only triggers if the first
    // delay is long enough. I have no idea why this is the case;
    // maybe it has something to do with when reflows happen.
    delay(50, (resolve) => {
      if (thank) {
        const onContinue = () => {
          Popup.hide();
          resolve();
        }
        const button = {label: 'Continue', class: 'bold', callback: onContinue}
        const text = 'Your feedback helps us improve Inkstone.'
        Popup.show({title: 'Thank you!', text: text, buttons: [button],
                    onBackdropClick: onContinue});
        return true;
      }
    }).then(() => {
      element.addClass('hiding');
    }).then(() => delay(150, () => {
      element.remove();
    }));
  }
};

Template.report_issue.events({
  'click .cancel': () => {
    ReportIssue.hide();
  },
  'click .report': () => {
    let message = $('textarea.report-mesg').val();
    console.log("Reporting issue:", ReportIssue.charData, message, ReportIssue.recording.strokeData);
    // TODO(zhaizhai): pass in a callback to handle errors and confirm
    // submission
    Meteor.call('reportIssue', JSON.stringify(ReportIssue.charData),
                message, ReportIssue.recording.strokeData);
    ReportIssue.hide(true /* thanks */);
  },
  'blur .report-mesg': () => {
    // Mobile keyboard inputs can mess up the scroll position, so we
    // fix it here.
    $(window).scrollTop(0);
    // TODO(zhaizhai): animate this scroll, it seems the usual
    // jQuery.animate runs into issues on mobile.
  }
});

export {StrokeRecording, ReportIssue}