import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  Renderer,
  ChangeDetectorRef,
  AfterViewInit
} from "@angular/core";
import { UserService } from "../user.service";
import { FormGroup, FormControl } from "@angular/forms";
import { Router } from "@angular/router";
// import Peer from 'peer';
declare const Peer: any;
declare const $: any;

declare const SockJS: any;
declare const Stomp: any;

@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.css"]
})
export class DashboardComponent implements OnInit {
  friends: any;
  user;
  peer;
  conn;
  remoteConn;
  call;
  remoteCall;
  @ViewChild("localVideo") localVideo: any;
  @ViewChild("remoteVideo") remoteVideo: any;

  @ViewChild("remoteAudio") remoteAudio: any;
  @ViewChild("localAudio") localAudio: any;

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

  messagePage: any = {};

  constructor(
    private userService: UserService,
    private router: Router,
    private renderer: Renderer,
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.userService.checkUser(false);
    this.user = this.userService.getLoggedInUser();
    this.msgFormInit();
    this.preparePeerConnection();
    this.getUserFriends();

    $("#myModal").on("hidden.bs.modal", () => {
      if (this.call) {
        this.call.close();
      } else {
        this.remoteCall.close();
      }
      this.call = null;
      this.remoteCall = null;
    });

    $("#audioCallModal").on("hidden.bs.modal", () => {
      if (this.call) {
        this.call.close();
      } else {
        this.remoteCall.close();
      }
      this.call = null;
      this.remoteCall = null;
    });
    $('[data-toggle="tooltip"]').tooltip();
    this.localVideo.nativeElement.muted = "muted";
    this.localAudio.nativeElement.muted = "muted";
  }

  prepareMessagePage() {
    this.clearMessageHistory();
    const date = new Date();
    this.messagePage.timeStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    this.messagePage.currentPage = 0;
  }

  getCurrentTimeStr() {
    const date = new Date();
    return `${("0" + date.getDate()).slice(-2)}-${("0" + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()} ${("0" + date.getHours()).slice(-2)}:${("0" + date.getMinutes()).slice(-2)}`;
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
    !this.localVideo ? this.localVideo.nativeElement.srcObject = null : '';
    !this.remoteVideo ? this.remoteVideo.nativeElementsrcObject = null : '';
    !this.localAudio ? this.localAudio.nativeElement.srcObject = null : '';
    !this.remoteAudio ? this.remoteAudio.nativeElementsrcObject = null : '';
  }

  preparePeerConnection() {
    this.peer = new Peer(this.user.peerId, { key: "lwjd5qra8257b9" });
    this.peer.on("open", id => {
      console.log("Peer opened: my peer ID is: " + id);
    });
    this.peer.on("connection", conn => {
      console.log("connection recived from remote peer", conn);
      this.conn = conn;
      this.prepareMessagePage();
      this.getPreviousMessage(this.conn.peer.replace("user-peer-id-", ""), false);
      this.conn.on("data", data => {
        console.log("message recieved from remote peer", data);
        console.log("p: " + this.conn.peer.replace("user-peer-id-", ""));
        this.sendIncomingMessage(data, this.getCurrentTimeStr(), "append");
        this.updateScroll();
      });
    });

    this.peer.on("call", call => {
      console.log("Call recieved from remote peer", call);
      console.log(call.metadata);
      this.remoteCall = call;

      if (this.remoteCall.metadata.callType == 'video') {
        this.getLocalVideoForAnswer();
      } else {
        this.getLocalAudioForAnswer();
      }
    });
  }

  connectTextChat(remotePeerId) {
    this.conn = this.peer.connect("user-peer-id-" + remotePeerId, {
      reliable: true
    });
    this.conn.on("open", () => {
      console.log("connected to: ", remotePeerId);
      this.prepareMessagePage();
      this.getPreviousMessage(remotePeerId, false);
    });
    this.conn.on("data", data => {
      console.log("message recieved from remote peer", data);
      this.sendIncomingMessage(data, this.getCurrentTimeStr(), "append");
      this.updateScroll();
    });
  }

  sendMessage() {
    console.log("sending msg: ", this.msgForm.value.msg);
    let message: any = {};
    let toUser: any = {};
    let fromUser: any = {};
    toUser.userId = this.user.userId;
    fromUser.userId = this.conn.peer.replace("user-peer-id-", "");
    message.toUser = toUser;
    message.fromUser = fromUser;
    message.message = this.msgForm.value.msg;
    this.userService.saveMessage(message).subscribe(
      data => {
        console.log(data);
        this.sendOutgoingMessage(this.msgForm.value.msg, this.getCurrentTimeStr(), "append");
        this.conn.send(this.msgForm.value.msg);
        this.updateScroll();
        $("#write_msg").val("");
      },
      error => {
        console.log(error);
      }
    );
  }

  getPreviousMessage(remotePeerId, isByScroll) {
    this.userService.getMessages(this.user.userId, remotePeerId, this.messagePage.currentPage, this.messagePage.timeStr).subscribe(
      data => {
        console.log(data);
        let messages: any = data;
        messages = messages.messages;
        messages.forEach(message => {
          console.log(message.message);
          if (message.toUser.userId == this.user.userId) {
            this.sendOutgoingMessage(message.message, message.creationTime, "prepend");
          } else {
            this.sendIncomingMessage(message.message, message.creationTime, "prepend");
          }
        });
        if (!isByScroll) {
          this.updateScroll();
        }
      },
      error => {
        console.log(error);
      }
    );
  }

  sendOutgoingMessage(msg, timeStr, appendType) {
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
      You: <div style=" font-size: 11px; font-weight: normal;
      color: black;">
      ${timeStr}
      </div>
    </div>
    <div class="out-msg" style="font-size: 13px;
    background-color: #05728f;
    padding: 4px 25px 4px 15px;
    border-radius: 5px;
    display: inline-block;
    color: white;">
      ${msg} </div>
      
      
    </div>`;
    if (appendType == "append") {
      $("#msgHistory").append(message);
    } else {
      $("#msgHistory").prepend(message);
    }
  }

  sendIncomingMessage(msg, timeStr, appendType) {
    let message = `<div class="inc-msg-div" style="margin-bottom: 10px;
    margin: 0px 20px 10px 20px;">
    <div class="inc-msg-profile" style="background-color: #36bbe0;
    color: black;
    font-size: 13px;
    font-weight: bold;
    padding: 4px 10px 4px 15px;
    border-radius: 20px;
    margin: 5px 5px 5px 5px;
    display: inline-block;">Remote Peer: <div style=" font-size: 11px; font-weight: normal;
    color: black;">
    ${timeStr}
    </div></div>
    <div class="inc-msg" style=" font-size: 13px;
    background-color: #dfdede;
  
    padding: 4px 25px 4px 15px;
    border-radius: 5px;
    display: inline-block;
    color: black;">
      ${msg}
      
      </div>
      
  </div>`;
    if (appendType == "append") {
      $("#msgHistory").append(message);
    } else {
      $("#msgHistory").prepend(message);
    }
  }

  saveMessage(msg) {
    let message: any = {};
    message.toUserId = this.user.userId;
    message.fromUserId = this.conn.peer.replace("user-peer-id-", "");
    message.message = msg;
    this.userService.saveMessage(message).subscribe(
      data => {
        console.log(data);
      },
      error => {
        console.log(error);
      }
    );
  }

  clearMessageHistory() {
    $("#msgHistory").html("");
  }

  connectVideoChat(remotePeerId) {
    this.getLocalVideoForOffer(remotePeerId);
  }

  getLocalVideoForOffer(remotePeerId) {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true
      })
      .then(stream => {
        this.localStream = stream;
        this.localVideo.nativeElement.srcObject = stream;
        this.call = this.peer.call(
          "user-peer-id-" + remotePeerId,
          this.localStream, { metadata: { callType: 'video' } }
        );
        this.call.on("stream", remoteStream => {
          this.remoteVideo.nativeElement.srcObject = remoteStream;
        });
        this.call.on("close", () => {
          this.closeCall();
          $("#myModal").modal("hide");
        });
      })
      .catch(e => console.error(e));
  }

  getLocalVideoForAnswer() {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true
      })
      .then(stream => {
        this.localStream = stream;
        $("#myModal").modal({ backdrop: "static", keyboard: false });
        this.localVideo.nativeElement.srcObject = this.localStream;
        this.remoteCall.answer(this.localStream);
        this.remoteCall.on("stream", remoteStream => {
          this.remoteVideo.nativeElement.srcObject = remoteStream;
        });
        this.remoteCall.on("close", () => {
          this.closeCall();
          $("#myModal").modal("hide");
        });
      })
      .catch(e => console.error(e));
  }

  connectAudioCall(remotePeerId) {
    this.getLocalAudioForOffer(remotePeerId);
  }

  getLocalAudioForOffer(remotePeerId) {
    navigator.mediaDevices
      .getUserMedia({
        audio: true
      })
      .then(stream => {
        this.localStream = stream;
        this.localAudio.nativeElement.srcObject = stream;
        this.call = this.peer.call(
          "user-peer-id-" + remotePeerId,
          this.localStream, { metadata: { callType: 'audio' } }
        );
        this.call.on("stream", remoteStream => {
          this.remoteAudio.nativeElement.srcObject = remoteStream;
        });
        this.call.on("close", () => {
          this.closeCall();
          $("#audioCallModal").modal("hide");
        });
      })
      .catch(e => console.error(e));
  }

  getLocalAudioForAnswer() {
    navigator.mediaDevices
      .getUserMedia({
        audio: true
      })
      .then(stream => {
        this.localStream = stream;
        $("#audioCallModal").modal({ backdrop: "static", keyboard: false });
        this.localAudio.nativeElement.srcObject = this.localStream;
        this.remoteCall.answer(this.localStream);
        this.remoteCall.on("stream", remoteStream => {
          this.remoteAudio.nativeElement.srcObject = remoteStream;
        });
        this.remoteCall.on("close", () => {
          this.closeCall();
          $("#audioCallModal").modal("hide");
        });
      })
      .catch(e => console.error(e));
  }

  msgFormInit() {
    this.msgForm = new FormGroup({
      msg: new FormControl("")
    });
  }

  logout() {
    this.userService.removeLoginUser();
    // this.sendOfflineMessage();
    if (this.stompClient !== null) {
      this.stompClient.disconnect({ "name:": "shivam" });
    }
    this.router.navigateByUrl("login");
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
    alert("sayHello");
  }

  updateScroll() {
    var element = document.getElementById("msgHistory");
    element.scrollTop = element.scrollHeight;
  }

  public prepareUser() {
    this.socket = new SockJS(
      `${this.userService._url}/ossnapi-websocket?userId=${this.user.userId}`
    );
    this.stompClient = Stomp.over(this.socket);
    this.stompClient.connect({}, frame => {
      console.log("Connected msg: " + frame);
      this.subscribeToPrivateMessage();
      // this.sendLoginMessage();
    });
  }

  public subscribeToPrivateMessage() {
    this.stompClient.subscribe("/user/queue/private", res => {
      console.log("got private response: " + res);
      console.log(res);
      if (JSON.parse(res.body).messageType == "online") {
        $(`.${JSON.parse(res.body).userId}-online`).each(function () {
          $(this).css("display", "inline-block");
        });
        // $(`.${JSON.parse(res.body).userId}-online`).css("display", "block");
      } else {
        $(`.${JSON.parse(res.body).userId}-online`).each(function () {
          $(this).css("display", "none");
        });
        // $(`.${JSON.parse(res.body).userId}-online`).css("display", "none");
      }
    });
  }

  public sendLoginMessage() {
    this.friends.forEach(element => {
      if (element.online) {
        $(`.${element.userId}-online`).each(function () {
          $(this).css("display", "inline-block");
        });
        // $(`.${element.userId}-online`).css("display", "block");
        this.stompClient.send(
          "/user/" + element.userId + "/queue/private",
          {},
          JSON.stringify({
            messageType: "online",
            userId: this.user.userId
          })
        );
      }
    });
  }

  public sendOfflineMessage() {
    this.friends.forEach(element => {
      if (element.online) {
        this.stompClient.send(
          "/user/" + element.userId + "/queue/private",
          {},
          JSON.stringify({
            messageType: "offline",
            userId: this.user.userId
          })
        );
      }
    });
  }

  onScroll() {
    console.log("scrolled down!!");
  }

  onUp() {
    console.log("scrolled up!!");
    this.messagePage.currentPage = this.messagePage.currentPage + 1;
    this.getPreviousMessage(this.conn.peer.replace("user-peer-id-", ""), true);
  }
}
