import java.io.*;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Scanner;

public class SocketSer {
    public static void main(String[] args) throws IOException {
    
		// ============= 1. 创建服务器端ServerSokcet对象 ==============
        
        // ==========================================================
        
        // ============= 2. 绑定到 8000 的指定端口号 ==============
        
        // =====================================================
        
        System.out.println("服务端端口号：8000等待连接。。。");
        while (true){
        
			// ============= 3. 调用accept( )方法持续接收客户端请求 ==============
            
            // ===============================================================
            
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        System.out.println("连接已建立!");
                        
                        // ============= 4. 在单独的线程中处理socket ==============
                        
                        // =====================================================
                        
                    }catch (Exception ex){
                        ex.printStackTrace();
                    }finally {
                        try {
                        
							// ============= 5. 关闭socket ==============
							
                            // =========================================
                            
                        } catch (IOException e) {

                        }
                        System.out.println("连接已断开!");
                    }
                }
            }).start();
        }
    }

    public static void clientConnectionThread(final Socket socket) throws IOException {
    
		// ============= 6. 用socket对象创建输入流对象以及输出流对象进行数据传输 ==============
        
        // =============================================================================


        Thread receiveThread = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                        while (true) {
							// ============= 7. 使用输入流对象接收客户端发过来的字符串并输出 ==============
                            
                            // =========================================================================

                            if (msg.equals("bye")) {
								// ============= 8. 当接收到字符串“bye“时，关闭连接和流 ==============
                                
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
                    
						// ============= 9. 使用输出流对象将字符串发送到客户端 ==============
                        
                        // =============================================================
                        
                    } catch (IOException e) {

                    }
                    if(msg.equals("bye")){
                        try {
                        
							// ============= 10. 当发出字符串“bye“时，关闭连接和流 ==============
                            
                            // =============================================================
                            
                        } catch (IOException e) {
                        }
                        return;
                    }
                }
            }
        });
	
		// ============= 11. 启动输出和输入线程 ==============
        
        // =================================================
        
        try {
            receiveThread.join();
        } catch (InterruptedException e) {
        }
        sendThread.interrupt();
    }
}
