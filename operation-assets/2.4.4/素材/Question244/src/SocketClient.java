import java.io.*;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Scanner;

public class SocketClient {
    public static void main(String[] args) throws IOException {

		// ============= 12. 创建socket ==============
        
        // ==========================================
        
        // ============= 13. 将socket连接到指定服务器和8000端口 ==============
        
        // ===============================================================
        
        System.out.println("客户端已和服务端建立连接");
        final DataOutputStream dos = new DataOutputStream(socket.getOutputStream());
        // 获取接收流
        final DataInputStream dis = new DataInputStream(socket.getInputStream());


        Thread receiveThread = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    while (true) {
                    
						// ============= 14. 使用输入流对象接收服务端发过来的字符串并输出 ==============
                        
                        // ========================================================================
		
                        if (msg.equals("bye")) {
                            System.out.println("连接已断开！");
                            
                            // ============= 15. 当接收到字符串“bye“时，关闭socket ==============
                            
                            // ===============================================================
                            
                            return;
                        }
                    }
                } catch (IOException e) {

                }
            }
        });
        Thread sendThread = new Thread(new Runnable() {
            @Override
            public void run() {
                Scanner scanner = new Scanner(System.in);
                while (true){

                    String msg = scanner.nextLine();
                    try {
                    
						// ============= 16. 使用输出流对象将字符串发送到服务端 ==============
                        
                        // ================================================================
                        
                    } catch (IOException e) {

                    }
                    if(msg.equals("bye")){
                        try {
                            System.out.println("连接已断开！");
                            
                            // ============= 17. 当发出字符串“bye“时，关闭socket ==============
                            
                            // =============================================================
                            
                        } catch (IOException e) {
                        }
                        return;
                    }
                }
            }
        });
		
		// ============= 18. 启动线程 ==============
        
        // =================================================
        
        try {
            receiveThread.join();
        } catch (InterruptedException e) {
        }
        sendThread.interrupt();
        
        // ============= 19. 关闭socket ==============
        
		// =================================================
    }
}
