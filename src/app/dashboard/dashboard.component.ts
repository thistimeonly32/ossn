import { Component, OnInit, ViewChild, ElementRef, Renderer, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { UserService } from '../user.service';
import { FormGroup, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
// import Peer from 'peer';
declare const Peer: any;
declare const $: any;

declare const SockJS: any;
declare const Stomp: any;


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  friends: any;
  user;
  peer;
  conn;
  remoteConn;
  call;
  remoteCall;
  @ViewChild('localVideo') localVideo: any;
  @ViewChild('remoteVideo') remoteVideo: any;

  msgHistory;
  msgForm: FormGroup;
  mediaStreamConstraints = {
    video: true,
    audio: true
  };
  localStream;
  remoteStream;
  socket;
  stompClient;

  constructor(private userService: UserService, private router: Router, private renderer: Renderer,
    private changeDetectorRef: ChangeDetectorRef) {

  }

  ngOnInit() {
    this.userService.checkUser(false);
    this.user = this.userService.getLoggedInUser();
    this.msgFormInit();
    this.preparePeerConnection();
    this.getUserFriends();

    $("#myModal").on("hidden.bs.modal", () => {
      // this.closeCall();
      if (this.call) {
        this.call.close();
      } else {
        this.remoteCall.close();
      }
      this.call = null;
      this.remoteCall = null;

    });

    $('[data-toggle="tooltip"]').tooltip();

    // let element: any = document.getElementById('localVideo');
    // element.muted = "muted";
    this.localVideo.nativeElement.muted = "muted";

    // $('#write_msg').keypress(function (e) {
    //   console.log("here");
    //   if (e.keyCode == 13)
    //     $('#msg_send_btn').click();
    // });
  }

  handleSendButton(evn) {
    if (evn.keyCode == 13) {
      this.sendMessage();
    }
  }


  closeCall() {
    this.localStream.getTracks().forEach(function (track) {
      track.stop();
    });
    this.localVideo.nativeElement.srcObject = null;
    this.remoteVideo.nativeElementsrcObject = null;
  }

  preparePeerConnection() {
    this.peer = new Peer(this.user.peerId, { key: 'lwjd5qra8257b9' });
    this.peer.on('open', (id) => {
      console.log('Peer opened: my peer ID is: ' + id);
    });
    this.peer.on('connection', (conn) => {
      console.log('connection recived from remote peer', conn);
      this.conn = conn;
      this.getPreviousMessage(this.conn.peer.replace('user-peer-id-', ''));
      this.conn.on('data', (data) => {
        console.log('message recieved from remote peer', data);
        console.log("p: " + this.conn.peer.replace('user-peer-id-', ''));
        this.sendIncomingMessage(data);
        this.updateScroll();
      });
    });

    this.peer.on('call', (call) => {
      console.log('Call recieved from remote peer', call);
      this.remoteCall = call;
      this.getLocalVideoForAnswer();
    });

  }

  connectTextChat(remotePeerId) {
    this.conn = this.peer.connect("user-peer-id-" + remotePeerId, {
      reliable: true
    });
    this.conn.on('open', () => {
      console.log('connected to: ', remotePeerId);
      this.getPreviousMessage(remotePeerId);
    });
    this.conn.on('data', (data) => {
      console.log('message recieved from remote peer', data);
      this.sendIncomingMessage(data);
      this.updateScroll();
    });
  }

  sendMessage() {
    console.log('sending msg: ', this.msgForm.value.msg);
    let message: any = {};
    let toUser: any = {};
    let fromUser: any = {};
    toUser.userId = this.user.userId;
    fromUser.userId = this.conn.peer.replace('user-peer-id-', '');
    message.toUser = toUser;
    message.fromUser = fromUser;
    message.message = this.msgForm.value.msg;
    this.userService.saveMessage(message).subscribe(data => {
      console.log(data);
      this.sendOutgoingMessage(this.msgForm.value.msg);
      this.conn.send(this.msgForm.value.msg);
      this.updateScroll();
      $('#write_msg').val("");
    },
      error => {
        console.log(error);
      });
  }

  getPreviousMessage(remotePeerId) {
    this.userService.getMessages(this.user.userId, remotePeerId).subscribe(data => {
      this.clearMessageHistory();
      console.log(data);
      let messages: any = data;
      messages.forEach(message => {
        console.log(message.message)
        if (message.toUser.userId == this.user.userId) {
          this.sendOutgoingMessage(message.message);
        } else {
          this.sendIncomingMessage(message.message);
        }
      })
      this.updateScroll();
    }, error => {
      console.log(error);
    });
  }

  sendOutgoingMessage(msg) {
    let message = `<div class="out-msg-div" style="text-align: right;
    margin: 0px 20px 10px 20px;">
    <div class="out-msg-profile" style="background-color: #36bbe0;
    color: black;
    font-size: 13px;
    font-weight: bold;
    padding: 4px 10px 4px 15px;
    border-radius: 20px;
    margin: 5px 5px 5px 5px;  
    display: inline-block;">
      You:
    </div>
    <div class="out-msg" style="font-size: 13px;
    background-color: #05728f;
    padding: 4px 25px 4px 15px;
    border-radius: 5px;
    display: inline-block;
    color: white;">
      ${msg} </div>
    </div>`
    $('#msgHistory').append(message);
  }

  sendIncomingMessage(msg) {
    let message = `<div class="inc-msg-div" style="margin-bottom: 10px;
    margin: 0px 20px 10px 20px;">
    <div class="inc-msg-profile" style="background-color: #36bbe0;
    color: black;
    font-size: 13px;
    font-weight: bold;
    padding: 4px 10px 4px 15px;
    border-radius: 20px;
    margin: 5px 5px 5px 5px;
    display: inline-block;">Remote Peer: </div>
    <div class="inc-msg" style=" font-size: 13px;
    background-color: #dfdede;
  
    padding: 4px 25px 4px 15px;
    border-radius: 5px;
    display: inline-block;
    color: black;">
      ${msg}
    </div>
  </div>`;
    $('#msgHistory').append(message);
  }

  saveMessage(msg) {
    let message: any = {};
    message.toUserId = this.user.userId;
    message.fromUserId = this.conn.peer.replace('user-peer-id-', '');
    message.message = msg;
    this.userService.saveMessage(message).subscribe(data => {
      console.log(data);
    },
      error => {
        console.log(error);
      });
  }

  clearMessageHistory() {
    $('#msgHistory').html("");
  }

  connectVideoChat(remotePeerId) {
    this.getLocalVideoForOffer(remotePeerId);
  }

  getLocalVideoForOffer(remotePeerId) {
    navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    }).then(stream => {
      this.localStream = stream;
      this.localVideo.nativeElement.srcObject = stream;
      this.call = this.peer.call("user-peer-id-" + remotePeerId, this.localStream);
      this.call.on('stream', (remoteStream) => {
        this.remoteVideo.nativeElement.srcObject = remoteStream;
      });
      this.call.on('close', () => {
        this.closeCall();
        $('#myModal').modal('hide');
      });
    }).catch(e => console.error(e));
  }

  getLocalVideoForAnswer() {
    navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    }).then(stream => {
      this.localStream = stream;
      $('#myModal').modal({ backdrop: 'static', keyboard: false });
      this.localVideo.nativeElement.srcObject = this.localStream;
      this.remoteCall.answer(this.localStream);
      this.remoteCall.on('stream', (remoteStream) => {
        this.remoteVideo.nativeElement.srcObject = remoteStream;
      });
      this.remoteCall.on('close', () => {
        this.closeCall();
        $('#myModal').modal('hide');
      });
    }).catch(e => console.error(e));
  }

  msgFormInit() {
    this.msgForm = new FormGroup({
      msg: new FormControl('')
    });
  }

  logout() {
    this.userService.removeLoginUser();
    // this.sendOfflineMessage();
    if (this.stompClient !== null) {
      this.stompClient.disconnect({'name:':'shivam'});
    }
    this.router.navigateByUrl('login');
  }

  getUserFriends() {
    this.userService.getFriends(this.user.userId).subscribe(
      data => {
        console.log(data);
        this.friends = data;
        this.userService.friends = data;
        this.prepareUser();
      },
      error => {
        console.log(error);
      }
    );
  }

  sayHello() {
    alert('sayHello');
  }

  updateScroll() {
    var element = document.getElementById("msgHistory");
    element.scrollTop = element.scrollHeight;
  }

  public prepareUser() {
    this.socket = new SockJS(`${this.userService._url}/ossnapi-websocket?userId=${this.user.userId}`);
    this.stompClient = Stomp.over(this.socket);
    this.stompClient.connect({}, (frame) => {
      console.log('Connected msg: ' + frame);
      this.subscribeToPrivateMessage();
      // this.sendLoginMessage();
    });
  }

  public subscribeToPrivateMessage() {
    this.stompClient.subscribe('/user/queue/private', (res) => {
      console.log("got private response: " + res);
      console.log(res);
      if (JSON.parse(res.body).messageType == 'online') {
        $(`#${JSON.parse(res.body).userId}-online`).css('display', 'block');
      } else {
        $(`#${JSON.parse(res.body).userId}-online`).css('display', 'none');
      }
    });
  }

  public sendLoginMessage() {
    this.friends.forEach(element => {
      if (element.online) {
        $(`#${element.userId}-online`).css('display', 'block');
        this.stompClient.send('/user/' + element.userId + '/queue/private', {}, JSON.stringify(
          {
            'messageType': 'online',
            'userId': this.user.userId
          }
        ));
      }
    });
  }

  public sendOfflineMessage() {
    this.friends.forEach(element => {
      if (element.online) {
        this.stompClient.send('/user/' + element.userId + '/queue/private', {}, JSON.stringify(
          {
            'messageType': 'offline',
            'userId': this.user.userId
          }
        ));
      }
    });
  }

  onScroll() {
    console.log('scrolled!!');
  }

  onUp(){
    console.log('scrolled up!!');
  }


}
