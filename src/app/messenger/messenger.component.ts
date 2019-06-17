import { Component, OnInit, ViewChild } from '@angular/core';
import { UserService } from '../user.service';
import { Router, ActivatedRoute } from '@angular/router';
declare const Peer: any;

@Component({
  selector: 'app-messenger',
  templateUrl: './messenger.component.html',
  styleUrls: ['./messenger.component.css']
})
export class MessengerComponent implements OnInit {

  user;
  peer;
  conn;
  remotePeerId;

  @ViewChild('hardwareVideo') hardwareVideo: any;

  _navigator = <any> navigator;
  localStream;
  
  constructor(private userService: UserService, private router: Router, private activatedRoute: ActivatedRoute) { }

  ngOnInit() {
    this.userService.checkUser(false);
    this.user = this.userService.getLoggedInUser();

    // this.activatedRoute.queryParams.subscribe(params => {
    //   this.remotePeerId = params['peer'];
    // });

    // this.peer = new Peer(this.user.peerId, { key: 'lwjd5qra8257b9' });
    // this.peer.on('open', function (id) {
    //   console.log('My peer ID is: ' + id);
    // });

    // console.log('connecting to: ', this.remotePeerId);
    // this.conn = this.peer.connect(this.remotePeerId, {
    //   reliable: true
    // });
    // console.log(this.conn);

    const video = this.hardwareVideo.nativeElement;
    // this._navigator = <any>navigator;

    // this._navigator.getUserMedia = ( this._navigator.getUserMedia || this._navigator.webkitGetUserMedia
    // || this._navigator.mozGetUserMedia || this._navigator.msGetUserMedia );

    // this._navigator.mediaDevices.getUserMedia({video: true})
    //   .then((stream) => {
    //     this.localStream = stream;
    //     video.src = window.URL.createObjectURL(stream);
    //     video.play();
    // });

    navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    }).then(stream => {
      this.localStream = stream;
      video.srcObject = stream;
    }).catch(e => console.error(e));
  }

  stopStream() {
    const tracks = this.localStream.getTracks();
    tracks.forEach((track) => {
      track.stop();
    });
  }

}
