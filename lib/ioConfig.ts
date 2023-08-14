import { Server, Socket } from 'socket.io'

export default (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client Connected!')

    socket.on('joinRoom', (room: string) => {
      console.log('joinRoom > ', room)
      socket.join(room)
    })

    socket.on('leaveRoom', (room: string) => {
      console.log('leaveRoom > ', room)
      socket.leave(room)
    })

    socket.on('disconnect', () => {
      console.log('Client Disconnected!')
    })
  })
}
