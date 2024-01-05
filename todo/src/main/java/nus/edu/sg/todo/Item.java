/**
 * 
 */
package nus.edu.sg.todo;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

/**
 * @author Irudaya Raj
 *
 */
@Entity (name = "tbl_item")
public class Item {
	
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id; 
	
	@Column(name = "name")
	private String name;

	/**
	 * @return the id
	 */
	public UUID getId() {
		return id;
	}

	/**
	 * @param id the id to set
	 */
	public void setId(UUID id) {
		this.id = id;
	}

	/**
	 * @return the name
	 */
	public String getName() {
		return name;
	}

	/**
	 * @param name the name to set
	 */
	public void setName(String name) {
		this.name = name;
	}
	
}
